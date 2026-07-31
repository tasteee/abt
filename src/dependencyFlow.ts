import readline from 'node:readline'
import { isRegistryDependency } from './dependencies.js'
import { updateDependencyVersions } from './updateDependency.js'
import { accent, bold, dim, getTerminalWidth, truncate } from './theme.js'
import type { DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js'

const FRIENDLY_SECTION_NAME: Record<DependencySectionT, string> = {
	dependencies: 'dependencies',
	peerDependencies: 'peerDependencies',
	devDependencies: 'devDependencies'
}

type DisplayItemT =
	| { kind: 'sectionOpen'; section: DependencySectionT }
	| { kind: 'dependency'; entryIndex: number; isLastInSection: boolean }
	| { kind: 'sectionClose'; section: DependencySectionT; isLastSection: boolean }

type DependencyChangeT = {
	name: string
	from: string
	to: string
}

type StagedChangeT = DependencyChangeT & {
	entryIndex: number
	kind: 'pin' | 'latest'
	isMajor: boolean
}

type KeypressT = { input: string; key: readline.Key }

type KeypressQueueT = {
	read: () => Promise<KeypressT>
	dispose: () => void
}

const listSectionsInOrder = (entries: DependencyEntryT[]): DependencySectionT[] => {
	return entries.reduce<DependencySectionT[]>((sections, entry) => {
		if (!sections.includes(entry.section)) sections.push(entry.section)
		return sections
	}, [])
}

const buildDisplayItems = (entries: DependencyEntryT[]): DisplayItemT[] => {
	const sections = listSectionsInOrder(entries)
	const items: DisplayItemT[] = []

	sections.forEach((section, sectionIndex) => {
		const entryIndexes = entries.flatMap((entry, entryIndex) => {
			return entry.section === section ? [entryIndex] : []
		})

		items.push({ kind: 'sectionOpen', section })
		entryIndexes.forEach((entryIndex, indexWithinSection) => {
			items.push({
				kind: 'dependency',
				entryIndex,
				isLastInSection: indexWithinSection === entryIndexes.length - 1
			})
		})
		items.push({ kind: 'sectionClose', section, isLastSection: sectionIndex === sections.length - 1 })
	})

	return items
}

const readMajorVersion = (version: string): number | undefined => {
	const match = version.match(/\d+\.\d+\.\d+/)
	if (match === null) return undefined
	return Number.parseInt(match[0].split('.')[0], 10)
}

export const isMajorUpgrade = (declaredVersion: string, latestVersion: string): boolean => {
	const declaredMajor = readMajorVersion(declaredVersion)
	const latestMajor = readMajorVersion(latestVersion)
	if (declaredMajor === undefined || latestMajor === undefined) return false
	return latestMajor > declaredMajor
}

const buildJsonDependencyText = (entry: DependencyEntryT, version: string, isLastInSection: boolean): string => {
	const comma = isLastInSection ? '' : ','
	return `  ${JSON.stringify(entry.name)}: ${JSON.stringify(version)}${comma}`
}

const buildActionRail = (entry: DependencyEntryT, stagedChange: StagedChangeT | undefined): string => {
	if (stagedChange !== undefined) {
		const stagedAction =
			stagedChange.kind === 'pin'
				? `[1] pin installed ${stagedChange.to}`
				: `[2] pin latest ${stagedChange.to}`
		const majorSuffix = stagedChange.isMajor ? ' · major' : ''
		return `was ${stagedChange.from} - staged ${stagedAction}${majorSuffix}`
	}

	const isRegistryVersion = isRegistryDependency(entry.declaredVersion)
	const installedTarget = isRegistryVersion ? (entry.installedVersion ?? 'unavailable') : 'unavailable'
	const latestTarget = entry.latestVersion ?? 'unavailable'
	const majorSuffix =
		entry.latestVersion !== undefined && isMajorUpgrade(entry.declaredVersion, entry.latestVersion) ? ' major' : ''
	return `[1] pin installed ${installedTarget} - [2] pin latest ${latestTarget}${majorSuffix}`
}

const buildDependencyLines = (
	entry: DependencyEntryT,
	entryIndex: number,
	isLastInSection: boolean,
	selectedIndex: number,
	stagedChange: StagedChangeT | undefined,
	jsonColumnWidth: number
): string[] => {
	const cursor = entryIndex === selectedIndex ? accent('❯') : ' '
	const displayedVersion = stagedChange?.to ?? entry.declaredVersion
	const jsonText = buildJsonDependencyText(entry, displayedVersion, isLastInSection)
	const actionRail = buildActionRail(entry, stagedChange)
	const lineBeforeRail = `${cursor} ${jsonText.padEnd(jsonColumnWidth)}`
	const availableRailWidth = getTerminalWidth() - lineBeforeRail.length - 3

	if (actionRail.length <= availableRailWidth) {
		return [`${lineBeforeRail} ${dim('│')} ${dim(actionRail)}`]
	}

	if (entryIndex === selectedIndex) return [`${cursor} ${jsonText}`, `    ${dim(actionRail)}`]
	if (availableRailWidth < 12) return [`${cursor} ${jsonText}`]
	return [`${lineBeforeRail} ${dim('│')} ${dim(truncate(actionRail, availableRailWidth))}`]
}

const calculateJsonColumnWidth = (
	items: DisplayItemT[],
	entries: DependencyEntryT[],
	stagedChanges: Map<number, StagedChangeT>
): number => {
	const lineLengths = items.flatMap(item => {
		if (item.kind !== 'dependency') return []
		const entry = entries[item.entryIndex]
		const version = stagedChanges.get(item.entryIndex)?.to ?? entry.declaredVersion
		return [buildJsonDependencyText(entry, version, item.isLastInSection).length]
	})

	const longestLine = Math.max(...lineLengths, 0)
	return Math.min(longestLine, Math.floor(getTerminalWidth() * 0.52))
}

const buildVisibleItems = (
	items: DisplayItemT[],
	selectedIndex: number,
	maximumItemCount: number
): DisplayItemT[] => {
	const selectedDisplayIndex = items.findIndex(item => item.kind === 'dependency' && item.entryIndex === selectedIndex)
	let startIndex = Math.max(0, selectedDisplayIndex - Math.floor(maximumItemCount / 2))
	startIndex = Math.min(startIndex, Math.max(0, items.length - maximumItemCount))

	const canIncludeSectionOpen = selectedDisplayIndex < startIndex + maximumItemCount - 1
	if (canIncludeSectionOpen && startIndex > 0 && items[startIndex - 1]?.kind === 'sectionOpen') startIndex -= 1

	return items.slice(startIndex, startIndex + maximumItemCount)
}

const describeLocation = (targetPackage: TargetPackageT): string => {
	return targetPackage.relativePath === '.' ? 'root' : targetPackage.relativePath
}

export const buildDependencyScreen = (
	entries: DependencyEntryT[],
	targetPackage: TargetPackageT,
	selectedIndex: number,
	stagedChanges: Map<number, StagedChangeT>,
	status: string
): string[] => {
	const displayItems = buildDisplayItems(entries)
	const maximumItemCount = Math.max(4, (process.stderr.rows ?? 24) - 6)
	const visibleItems = buildVisibleItems(displayItems, selectedIndex, maximumItemCount)
	const jsonColumnWidth = calculateJsonColumnWidth(displayItems, entries, stagedChanges)
	const lines = [`[ abt ∆ dependencies ] ${dim(describeLocation(targetPackage))}`]

	for (const item of visibleItems) {
		if (item.kind === 'sectionOpen') {
			lines.push(`  ${bold(`${JSON.stringify(FRIENDLY_SECTION_NAME[item.section])}: {`)}`)
			continue
		}

		if (item.kind === 'sectionClose') {
			lines.push(`  ${bold(item.isLastSection ? '}' : '},')}`)
			continue
		}

		lines.push(
			...buildDependencyLines(
				entries[item.entryIndex],
				item.entryIndex,
				item.isLastInSection,
				selectedIndex,
				stagedChanges.get(item.entryIndex),
				jsonColumnWidth
			)
		)
	}

	const changeCount = stagedChanges.size
	const changeLabel = changeCount === 0 ? '' : ` · ${changeCount} staged`
	lines.push(dim(`  ↑ ↓ move · 1 pin installed · 2 use latest · enter apply · esc cancel${changeLabel}`))
	if (status.length > 0) lines.push(`  ${status}`)
	return lines
}

const clearRenderedLines = (lineCount: number): void => {
	if (lineCount === 0) return
	process.stderr.write('\r\u001B[2K')
	for (let index = 1; index < lineCount; index += 1) process.stderr.write('\u001B[1A\r\u001B[2K')
}

const createKeypressQueue = (): KeypressQueueT => {
	const queuedKeypresses: KeypressT[] = []
	let waitingReader: ((keypress: KeypressT) => void) | undefined

	const handleKeypress = (input: string, key: readline.Key): void => {
		const keypress = { input, key }
		if (waitingReader === undefined) {
			queuedKeypresses.push(keypress)
			return
		}

		const resolve = waitingReader
		waitingReader = undefined
		resolve(keypress)
	}

	process.stdin.on('keypress', handleKeypress)

	return {
		read: async () => {
			const queued = queuedKeypresses.shift()
			if (queued !== undefined) return queued
			return await new Promise(resolve => {
				waitingReader = resolve
			})
		},
		dispose: () => process.stdin.off('keypress', handleKeypress)
	}
}

export const runDependencyFlow = async (
	entries: DependencyEntryT[],
	targetPackage: TargetPackageT
): Promise<DependencyChangeT[]> => {
	readline.emitKeypressEvents(process.stdin)
	const keypressQueue = createKeypressQueue()
	const wasRaw = process.stdin.isRaw
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stderr.write('\u001B[?25l')

	let selectedIndex = 0
	let renderedLineCount = 0
	let status = ''
	let majorConfirmationArmed = false
	const stagedChanges = new Map<number, StagedChangeT>()
	let appliedChanges: DependencyChangeT[] = []

	const render = (): void => {
		clearRenderedLines(renderedLineCount)
		const lines = buildDependencyScreen(entries, targetPackage, selectedIndex, stagedChanges, status)
		process.stderr.write(lines.join('\n'))
		renderedLineCount = lines.length
	}

	try {
		render()

		for (;;) {
			const { input, key } = await keypressQueue.read()
			const wantsExit = key.name === 'escape' || input === 'q' || (key.ctrl === true && key.name === 'c')
			if (wantsExit) break

			if (key.name !== 'return') majorConfirmationArmed = false

			if (key.name === 'up' || input === 'k') {
				selectedIndex = Math.max(0, selectedIndex - 1)
				status = ''
				render()
				continue
			}

			if (key.name === 'down' || input === 'j') {
				selectedIndex = Math.min(entries.length - 1, selectedIndex + 1)
				status = ''
				render()
				continue
			}

			const entry = entries[selectedIndex]

			if (input === '1') {
				if (!isRegistryDependency(entry.declaredVersion)) {
					status = dim(`${entry.name} uses a local or aliased spec and cannot be pinned safely.`)
				} else if (entry.installedVersion === undefined) {
					status = dim(`${entry.name} is not installed, so there is no resolved version to pin.`)
				} else if (entry.installedVersion === entry.declaredVersion) {
					stagedChanges.delete(selectedIndex)
					status = dim(`${entry.name} is already pinned to ${entry.installedVersion}.`)
				} else {
					stagedChanges.set(selectedIndex, {
						entryIndex: selectedIndex,
						name: entry.name,
						from: entry.declaredVersion,
						to: entry.installedVersion,
						kind: 'pin',
						isMajor: false
					})
					status = `${entry.name} ${dim(`${entry.declaredVersion} → ${entry.installedVersion} staged`)}`
				}

				render()
				continue
			}

			if (input === '2') {
				if (entry.latestVersion === undefined) {
					status = dim(`${entry.name}: ${entry.latestError ?? 'latest version unavailable'}.`)
				} else if (entry.latestVersion === entry.declaredVersion) {
					stagedChanges.delete(selectedIndex)
					status = dim(`${entry.name} already declares the latest version.`)
				} else {
					const major = isMajorUpgrade(entry.declaredVersion, entry.latestVersion)
					stagedChanges.set(selectedIndex, {
						entryIndex: selectedIndex,
						name: entry.name,
						from: entry.declaredVersion,
						to: entry.latestVersion,
						kind: 'latest',
						isMajor: major
					})
					status = `${entry.name} ${dim(`${entry.declaredVersion} → ${entry.latestVersion} staged${major ? ' (major)' : ''}`)}`
				}

				render()
				continue
			}

			if (key.name === 'return') {
				if (stagedChanges.size === 0) {
					status = dim('No changes are staged.')
					render()
					continue
				}

				const hasMajorUpgrade = [...stagedChanges.values()].some(change => change.isMajor)
				if (hasMajorUpgrade && !majorConfirmationArmed) {
					majorConfirmationArmed = true
					status = 'Major upgrade staged. Press enter again to apply.'
					render()
					continue
				}

				const changes = [...stagedChanges.values()].sort((left, right) => left.entryIndex - right.entryIndex)
				updateDependencyVersions(
					targetPackage.directory,
					changes.map(change => ({
						section: entries[change.entryIndex].section,
						packageName: change.name,
						currentVersion: change.from,
						nextVersion: change.to
					}))
				)
				appliedChanges = changes.map(({ name, from, to }) => ({ name, from, to }))
				break
			}
		}
	} finally {
		keypressQueue.dispose()
		clearRenderedLines(renderedLineCount)
		process.stderr.write('\u001B[?25h')
		process.stdin.setRawMode(wasRaw === true)
		process.stdin.pause()
	}

	return appliedChanges
}
