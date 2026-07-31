import { buildShortName } from './packageNames.js'
import { dim, flattenCommand, symbols } from './theme.js'
import type { ContextT, MenuRowT, TargetPackageT } from './types.js'

// Menu values are self-describing so the flow can branch on a
// selection without carrying hidden state alongside it.
export const RUN_PREFIX = 'run:'
export const OPEN_PREFIX = 'open:'

export const buildRunValue = (scriptName: string): string => {
	return `${RUN_PREFIX}${scriptName}`
}

export const buildOpenValue = (packageRelativePath: string): string => {
	return `${OPEN_PREFIX}${packageRelativePath}`
}

export const readRunValue = (value: string): string | undefined => {
	const isRunValue = value.startsWith(RUN_PREFIX)
	if (!isRunValue) return undefined
	return value.slice(RUN_PREFIX.length)
}

export const readOpenValue = (value: string): string | undefined => {
	const isOpenValue = value.startsWith(OPEN_PREFIX)
	if (!isOpenValue) return undefined
	return value.slice(OPEN_PREFIX.length)
}

const COLUMN_GAP = 3
type RawRowT = {
	name: string
	detail: string
	alternateDetail?: string
	searchText?: string
	value: string
}

// Names sit in one column and details in a second, dimmed one, so
// the eye scans a column instead of parsing a paragraph.
const alignRows = (rawRows: RawRowT[]): MenuRowT[] => {
	const nameLengths = rawRows.map(rawRow => rawRow.name.length)
	const longestNameLength = Math.max(...nameLengths, 0)
	const nameColumnWidth = longestNameLength + COLUMN_GAP

	return rawRows.map(rawRow => {
		const padding = ' '.repeat(nameColumnWidth - rawRow.name.length)
		const buildLabel = (detail: string): string => {
			if (detail.length === 0) return rawRow.name
			return `${rawRow.name}${padding}${dim(detail)}`
		}
		return {
			label: buildLabel(rawRow.detail),
			...(rawRow.alternateDetail === undefined ? {} : { alternateLabel: buildLabel(rawRow.alternateDetail) }),
			...(rawRow.searchText === undefined ? {} : { searchText: rawRow.searchText }),
			value: rawRow.value
		}
	})
}

const buildScriptRows = (targetPackage: TargetPackageT, recentScripts: string[]): RawRowT[] => {
	const declaredScriptNames = Object.keys(targetPackage.scriptsByName)
	const recentOrder = new Map(recentScripts.map((scriptName, index) => [scriptName, index]))
	const declaredOrder = new Map(declaredScriptNames.map((scriptName, index) => [scriptName, index]))
	const scriptNames = [...declaredScriptNames].sort((left, right) => {
		const leftRecent = recentOrder.get(left)
		const rightRecent = recentOrder.get(right)
		if (leftRecent !== undefined && rightRecent !== undefined) return leftRecent - rightRecent
		if (leftRecent !== undefined) return -1
		if (rightRecent !== undefined) return 1
		return (declaredOrder.get(left) ?? 0) - (declaredOrder.get(right) ?? 0)
	})

	return scriptNames.map(scriptName => {
		const command = flattenCommand(targetPackage.scriptsByName[scriptName])
		const description = targetPackage.scriptDescriptionsByName?.[scriptName]
		const recentSuffix = recentOrder.has(scriptName) ? ` ${symbols().bullet} recent` : ''
		const primaryDetail = `${description === undefined ? command : flattenCommand(description)}${recentSuffix}`
		const commandDetail = `${command}${recentSuffix}`
		return {
			name: scriptName,
			detail: primaryDetail,
			...(description === undefined ? {} : { alternateDetail: commandDetail }),
			searchText: `${scriptName} ${command} ${description ?? ''}`,
			value: buildRunValue(scriptName)
		}
	})
}

// The default menu is scripts and nothing else. Packages live one
// keypress away rather than at the bottom of every list.
export const buildScriptMenuRows = (targetPackage: TargetPackageT, recentScripts: string[] = []): MenuRowT[] => {
	return alignRows(buildScriptRows(targetPackage, recentScripts))
}

const describeScriptCount = (targetPackage: TargetPackageT): string => {
	const scriptCount = Object.keys(targetPackage.scriptsByName).length
	const isSingle = scriptCount === 1
	if (isSingle) return '1 script'
	return `${scriptCount} scripts`
}

export const listBrowsablePackages = (context: ContextT): TargetPackageT[] => {
	return context.workspace.packages.filter(candidatePackage => {
		const hasScripts = Object.keys(candidatePackage.scriptsByName).length > 0
		return hasScripts
	})
}

// The package list names where each one lives and how much is in
// it — the two things you weigh when choosing where to look.
export const buildPackageMenuRows = (context: ContextT): MenuRowT[] => {
	const browsablePackages = listBrowsablePackages(context)

	const rawRows = browsablePackages.map(browsablePackage => {
		const isCurrent = browsablePackage.directory === context.currentPackage.directory
		const locationName = browsablePackage.isRoot ? 'workspace root' : browsablePackage.relativePath
		const currentMarker = isCurrent ? ` ${symbols().bullet} you are here` : ''

		return {
			name: buildShortName(browsablePackage),
			detail: `${describeScriptCount(browsablePackage)} ${symbols().bullet} ${locationName}${currentMarker}`,
			value: buildOpenValue(browsablePackage.relativePath)
		}
	})

	return alignRows(rawRows)
}
