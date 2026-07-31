import { buildShortName } from './packageNames.js'
import { dim, flattenCommand, getTerminalWidth, symbols, truncate } from './theme.js'
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
const CURSOR_GUTTER = 2

type RawRowT = {
	name: string
	detail: string
	value: string
}

// Names sit in one column and details in a second, dimmed one, so
// the eye scans a column instead of parsing a paragraph.
const alignRows = (rawRows: RawRowT[]): MenuRowT[] => {
	const nameLengths = rawRows.map(rawRow => rawRow.name.length)
	const longestNameLength = Math.max(...nameLengths, 0)
	const nameColumnWidth = longestNameLength + COLUMN_GAP

	const terminalWidth = getTerminalWidth()
	const detailWidth = terminalWidth - nameColumnWidth - CURSOR_GUTTER - 1

	return rawRows.map(rawRow => {
		const padding = ' '.repeat(nameColumnWidth - rawRow.name.length)
		const hasNoDetail = rawRow.detail.length === 0
		if (hasNoDetail) return { label: rawRow.name, value: rawRow.value }

		const fittedDetail = truncate(rawRow.detail, Math.max(detailWidth, 0))
		const label = `${rawRow.name}${padding}${dim(fittedDetail)}`
		return { label, value: rawRow.value }
	})
}

const buildScriptRows = (targetPackage: TargetPackageT): RawRowT[] => {
	const scriptNames = Object.keys(targetPackage.scriptsByName)

	return scriptNames.map(scriptName => {
		const command = targetPackage.scriptsByName[scriptName]
		return { name: scriptName, detail: flattenCommand(command), value: buildRunValue(scriptName) }
	})
}

// The default menu is scripts and nothing else. Packages live one
// keypress away rather than at the bottom of every list.
export const buildScriptMenuRows = (targetPackage: TargetPackageT): MenuRowT[] => {
	return alignRows(buildScriptRows(targetPackage))
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
