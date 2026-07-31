import readline from 'node:readline'
import { isRegistryDependency } from './dependencies.js'
import { fuzzyFilter } from './fuzzy.js'
import { updateDependencyVersions } from './updateDependency.js'
import { accent, bold, dim, getTerminalWidth, highlight, truncate } from './theme.js'
import type { DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js'

const FRIENDLY_SECTION_NAME: Record<DependencySectionT, string> = {
	dependencies: 'dependencies',
	peerDependencies: 'peerDependencies',
	devDependencies: 'devDependencies'
}

type DependencyChangeT = {
	name: string
	from: string
	to: string
}

export type StagedChangeT = DependencyChangeT & {
	entryIndex: number
	kind: 'installed' | 'major' | 'latest'
}

type VersionChoiceT = StagedChangeT['kind']
export type VersionColumnT = 'declared' | VersionChoiceT
type VersionTrackChoiceT = { kind: VersionColumnT; version: string | undefined }
type TableModeT = 'full' | 'compact' | 'narrow'
type KeypressT = { input: string | undefined; key: readline.Key }

type KeypressQueueT = {
	read: () => Promise<KeypressT>
	dispose: () => void
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

const describeLocation = (targetPackage: TargetPackageT): string => {
	const location = targetPackage.relativePath === '.' ? 'root' : targetPackage.relativePath
	return `${location}/package.json`
}

const padCell = (value: string, width: number): string => truncate(value, width).padEnd(width)

const buildTitle = (targetPackage: TargetPackageT, width: number): string => {
	const title = '[ abt ∆ dependencies ]'
	const location = describeLocation(targetPackage)
	const availableLocationWidth = Math.max(1, width - title.length - 2)
	const displayedLocation = truncate(location, availableLocationWidth)
	return `[ ${accent('abt')} ∆ dependencies ]  ${dim(displayedLocation)}`
}

const getTableMode = (width: number): TableModeT => {
	if (width >= 92) return 'full'
	if (width >= 68) return 'compact'
	return 'narrow'
}

const displayVersion = (version: string | undefined): string => version ?? '—'

export const listFilteredDependencyIndexes = (entries: DependencyEntryT[], query: string): number[] => {
	return fuzzyFilter(
		entries.map((entry, entryIndex) => ({ entry, entryIndex })),
		query,
		candidate => candidate.entry.name
	).map(candidate => candidate.entryIndex)
}

const buildColumnHeader = (mode: Exclude<TableModeT, 'narrow'>, width: number): string => {
	if (mode === 'full') {
		const nameWidth = Math.max(20, width - 56)
		return dim(
			`   ${' '.repeat(nameWidth)}${padCell('declared', 14)}${padCell('installed', 14)}${padCell('major', 12)}latest`
		)
	}

	const nameWidth = Math.max(18, width - 49)
	return dim(
		`   ${' '.repeat(nameWidth)}${padCell('declared', 12)}${padCell('installed', 12)}${padCell('major', 11)}latest`
	)
}

const buildDependencyRow = (
	entry: DependencyEntryT,
	entryIndex: number,
	isLastInSection: boolean,
	selectedIndex: number,
	stagedChange: StagedChangeT | undefined,
	focusedColumn: VersionColumnT | undefined,
	mode: TableModeT,
	width: number
): string => {
	const isSelected = entryIndex === selectedIndex
	const cursor = isSelected ? accent('❯') : ' '
	const declared = JSON.stringify(stagedChange?.to ?? entry.declaredVersion) + (stagedChange === undefined ? '' : ' ←')

	if (mode === 'narrow') {
		const comma = isLastInSection ? '' : ','
		const name = `${JSON.stringify(entry.name)}: `
		const availableDeclaredWidth = Math.max(1, width - 3 - name.length - comma.length)
		const displayedDeclared = truncate(declared, availableDeclaredWidth)
		return `${cursor}  ${name}${focusedColumn === 'declared' ? highlight(displayedDeclared) : displayedDeclared}${comma}`
	}

	const versionWidth = mode === 'full' ? 14 : 12
	const majorWidth = mode === 'full' ? 12 : 11
	const nameWidth = mode === 'full' ? Math.max(20, width - 56) : Math.max(18, width - 49)
	const name = mode === 'full' ? `${JSON.stringify(entry.name)}:` : `${entry.name}:`

	const declaredCell = padCell(declared, versionWidth)
	const installedCell = padCell(displayVersion(entry.installedVersion), versionWidth)
	const majorCell = padCell(displayVersion(entry.majorVersion), majorWidth)
	const latestWidth = Math.max(1, width - nameWidth - versionWidth * 2 - majorWidth - 3)
	const latestCell = padCell(displayVersion(entry.latestVersion), latestWidth)
	const focusCell = (cell: string, column: VersionColumnT): string =>
		focusedColumn === column ? highlight(cell) : cell
	return (
		`${cursor}  ${padCell(name, nameWidth)}` +
		`${focusCell(declaredCell, 'declared')}` +
		`${focusCell(installedCell, 'installed')}` +
		`${focusCell(majorCell, 'major')}` +
		`${focusCell(latestCell, 'latest')}`
	)
}

const hasLaterSection = (entries: DependencyEntryT[], entryIndex: number): boolean => {
	return entries.slice(entryIndex + 1).some(entry => entry.section !== entries[entryIndex].section)
}

const buildViewportRows = (
	entries: DependencyEntryT[],
	startIndex: number,
	endIndex: number,
	selectedIndex: number,
	stagedChanges: Map<number, StagedChangeT>,
	focusedColumns: Map<number, VersionColumnT>,
	mode: TableModeT,
	width: number
): string[] => {
	const lines: string[] = []
	let openSection: DependencySectionT | undefined

	for (let entryIndex = startIndex; entryIndex < endIndex; entryIndex += 1) {
		const entry = entries[entryIndex]
		if (entry.section !== openSection) {
			if (openSection !== undefined) {
				const previousIndex = entryIndex - 1
				lines.push(` ${hasLaterSection(entries, previousIndex) ? '},' : '}'}`)
			}

			openSection = entry.section
			lines.push(` ${bold(`${JSON.stringify(FRIENDLY_SECTION_NAME[entry.section])}: {`)}`)
			if (entryIndex > 0 && entries[entryIndex - 1].section === entry.section) lines.push(dim('   …'))
		}

		const isLastInSection = entries[entryIndex + 1]?.section !== entry.section
		lines.push(
			buildDependencyRow(
				entry,
				entryIndex,
				isLastInSection,
				selectedIndex,
				stagedChanges.get(entryIndex),
				entryIndex === selectedIndex ? (focusedColumns.get(entryIndex) ?? 'declared') : undefined,
				mode,
				width
			)
		)
	}

	if (openSection !== undefined && endIndex < entries.length && entries[endIndex].section === openSection) {
		lines.push(dim('   …'))
	}
	if (openSection !== undefined) lines.push(` ${hasLaterSection(entries, endIndex - 1) ? '},' : '}'}`)
	return lines
}

const chooseViewport = (
	entries: DependencyEntryT[],
	selectedIndex: number,
	maximumLineCount: number,
	stagedChanges: Map<number, StagedChangeT>,
	focusedColumns: Map<number, VersionColumnT>,
	mode: TableModeT,
	width: number
): { startIndex: number; endIndex: number; lines: string[] } => {
	let startIndex = selectedIndex
	let endIndex = selectedIndex + 1
	let lines = buildViewportRows(entries, startIndex, endIndex, selectedIndex, stagedChanges, focusedColumns, mode, width)
	let preferBefore = true

	for (;;) {
		const candidates = preferBefore
			? [startIndex > 0 ? { start: startIndex - 1, end: endIndex } : undefined, endIndex < entries.length ? { start: startIndex, end: endIndex + 1 } : undefined]
			: [endIndex < entries.length ? { start: startIndex, end: endIndex + 1 } : undefined, startIndex > 0 ? { start: startIndex - 1, end: endIndex } : undefined]

		const fittingCandidate = candidates
			.filter((candidate): candidate is { start: number; end: number } => candidate !== undefined)
			.map(candidate => ({
				...candidate,
				lines: buildViewportRows(entries, candidate.start, candidate.end, selectedIndex, stagedChanges, focusedColumns, mode, width)
			}))
			.find(candidate => candidate.lines.length <= maximumLineCount)

		if (fittingCandidate === undefined) break
		startIndex = fittingCandidate.start
		endIndex = fittingCandidate.end
		lines = fittingCandidate.lines
		preferBefore = !preferBefore
	}

	return { startIndex, endIndex, lines }
}

const centerLine = (value: string, width: number): string => {
	const displayed = truncate(value, width)
	return `${' '.repeat(Math.max(0, Math.floor((width - displayed.length) / 2)))}${displayed}`
}

const buildNarrowDetail = (
	entry: DependencyEntryT,
	stagedChange: StagedChangeT | undefined,
	focusedColumn: VersionColumnT,
	width: number
): string => {
	const versionWidth = Math.max(1, Math.floor((width - 27) / 4))
	const cells: Array<{ label: string; column: VersionColumnT; version: string }> = [
		{ label: 'decl', column: 'declared', version: stagedChange?.to ?? entry.declaredVersion },
		{ label: 'inst', column: 'installed', version: displayVersion(entry.installedVersion) },
		{ label: 'maj', column: 'major', version: displayVersion(entry.majorVersion) },
		{ label: 'lat', column: 'latest', version: displayVersion(entry.latestVersion) }
	]

	return cells
		.map(cell => {
			const version = padCell(cell.version, versionWidth)
			return `${dim(cell.label)} ${focusedColumn === cell.column ? highlight(version) : version}`
		})
		.join(dim(' │ '))
		.trimEnd()
}

export const buildDependencyScreen = (
	entries: DependencyEntryT[],
	targetPackage: TargetPackageT,
	selectedIndex: number,
	stagedChanges: Map<number, StagedChangeT>,
	status: string,
	focusedColumns = new Map<number, VersionColumnT>(),
	query = ''
): string[] => {
	const width = getTerminalWidth()
	const mode = getTableMode(width)
	const filteredEntryIndexes = listFilteredDependencyIndexes(entries, query)
	const filteredEntries = filteredEntryIndexes.map(entryIndex => entries[entryIndex])
	const filteredSelectedIndex = Math.max(0, filteredEntryIndexes.indexOf(selectedIndex))
	const filteredStagedChanges = new Map<number, StagedChangeT>()
	const filteredFocusedColumns = new Map<number, VersionColumnT>()
	filteredEntryIndexes.forEach((entryIndex, filteredIndex) => {
		const stagedChange = stagedChanges.get(entryIndex)
		if (stagedChange !== undefined) filteredStagedChanges.set(filteredIndex, { ...stagedChange, entryIndex: filteredIndex })
		const focusedColumn = focusedColumns.get(entryIndex)
		if (focusedColumn !== undefined) filteredFocusedColumns.set(filteredIndex, focusedColumn)
	})

	const maximumViewportLines = Math.max(3, (process.stderr.rows ?? 24) - 6)
	const viewport =
		filteredEntries.length === 0
			? undefined
			: chooseViewport(
					filteredEntries,
					filteredSelectedIndex,
					maximumViewportLines,
					filteredStagedChanges,
					filteredFocusedColumns,
					mode,
					width
				)
	const filterText = query.length === 0 ? dim('(type to filter…)') : query
	const lines = [buildTitle(targetPackage, width), `${dim('filter:')} ${filterText}`]

	if (mode !== 'narrow') lines.push(buildColumnHeader(mode, width))
	if (viewport === undefined) lines.push(dim(`  no dependencies match ${JSON.stringify(query)}`))
	else lines.push(...viewport.lines)
	if (mode === 'narrow' && viewport !== undefined) {
		lines.push(
			buildNarrowDetail(
				filteredEntries[filteredSelectedIndex],
				filteredStagedChanges.get(filteredSelectedIndex),
				filteredFocusedColumns.get(filteredSelectedIndex) ?? 'declared',
				width
			)
		)
	}

	const isWindowed = viewport !== undefined && (viewport.startIndex > 0 || viewport.endIndex < filteredEntries.length)
	const range =
		query.length > 0
			? viewport === undefined
				? `dependencies 0 matches · ${entries.length} total`
				: isWindowed
					? `dependencies ${viewport.startIndex + 1}–${viewport.endIndex} of ${filteredEntries.length} matches · ${entries.length} total`
					: `dependencies ${filteredEntries.length} matches · ${entries.length} total`
			: isWindowed && viewport !== undefined
				? `dependencies ${viewport.startIndex + 1}–${viewport.endIndex} of ${entries.length}`
				: `dependencies ${entries.length}`
	const staged = stagedChanges.size === 0 ? '' : ` · ${stagedChanges.size} staged`
	lines.push(dim(centerLine(`${range}${staged}`, width)))

	const controls =
		mode === 'full'
			? '↑↓ dependency · ←→ version · pgup/pgdn jump · enter review · esc clear/cancel'
			: mode === 'compact'
				? '↑↓ row · ←→ version · pgup/pgdn · enter review · esc'
				: '↑↓ row · ←→ version · enter · esc'
	lines.push(dim(truncate(controls, width)))
	lines.push(status.length === 0 ? ' ' : truncate(status, width))
	return lines
}

const listStagedChanges = (stagedChanges: Map<number, StagedChangeT>): StagedChangeT[] => {
	return [...stagedChanges.values()].sort((left, right) => left.entryIndex - right.entryIndex)
}

export const buildReviewScreen = (stagedChanges: Map<number, StagedChangeT>, offset = 0): string[] => {
	const changes = listStagedChanges(stagedChanges)
	const width = getTerminalWidth()
	const pageSize = Math.max(1, (process.stderr.rows ?? 24) - 4)
	const maximumOffset = Math.max(0, changes.length - pageSize)
	const startIndex = Math.min(Math.max(0, offset), maximumOffset)
	const visibleChanges = changes.slice(startIndex, startIndex + pageSize)
	const longestName = Math.max(...visibleChanges.map(change => change.name.length), 0)
	const nameWidth = Math.min(longestName, Math.max(8, Math.floor(width * 0.4)))
	const lines = [bold(`Review ${changes.length} change${changes.length === 1 ? '' : 's'}`), '']

	for (const change of visibleChanges) {
		const row = `  ${padCell(change.name, nameWidth)}  ${change.from}  →  ${change.to}`
		lines.push(truncate(row, width))
	}

	if (changes.length > pageSize) {
		lines.push(dim(centerLine(`changes ${startIndex + 1}–${startIndex + visibleChanges.length} of ${changes.length}`, width)))
		lines.push(dim(truncate('↑↓ scroll · pgup/pgdn jump · enter apply · esc go back', width)))
	} else {
		lines.push(dim('enter apply · esc go back'))
	}
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

	const handleKeypress = (input: string | undefined, key: readline.Key): void => {
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

export const isPrintableInput = (input: string | undefined, key: readline.Key): boolean => {
	if (key.ctrl === true || key.meta === true || input === undefined || input.length === 0) return false
	return [...input].every(character => {
		const characterCode = character.codePointAt(0) ?? 0
		return characterCode >= 32 && characterCode !== 127
	})
}

const removeLastCharacter = (value: string): string => [...value].slice(0, -1).join('')

const getChoiceVersion = (entry: DependencyEntryT, choice: VersionChoiceT): string | undefined => {
	if (choice === 'installed') return entry.installedVersion
	if (choice === 'major') return entry.majorVersion
	return entry.latestVersion
}

const getChoiceError = (entry: DependencyEntryT, choice: VersionChoiceT): string => {
	if (choice === 'installed') return 'no installed version is available'
	if (choice === 'major') return entry.majorError ?? 'no version is available for the installed major'
	return entry.latestError ?? 'latest version unavailable'
}

export const listVersionTrackChoices = (entry: DependencyEntryT): VersionTrackChoiceT[] => {
	return [
		{ kind: 'declared', version: entry.declaredVersion },
		{ kind: 'installed', version: entry.installedVersion },
		{ kind: 'major', version: entry.majorVersion },
		{ kind: 'latest', version: entry.latestVersion }
	]
}

export const moveVersionColumn = (
	entry: DependencyEntryT,
	currentColumn: VersionColumnT,
	direction: -1 | 1
): VersionColumnT => {
	const choices = listVersionTrackChoices(entry)
	const currentIndex = Math.max(0, choices.findIndex(choice => choice.kind === currentColumn))
	const nextIndex = Math.min(choices.length - 1, Math.max(0, currentIndex + direction))
	return choices[nextIndex].kind
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
	let query = ''
	let screen: 'dependencies' | 'review' = 'dependencies'
	let reviewOffset = 0
	const stagedChanges = new Map<number, StagedChangeT>()
	const focusedColumns = new Map<number, VersionColumnT>()
	let appliedChanges: DependencyChangeT[] = []

	const stageChoice = (choice: VersionChoiceT): void => {
		const entry = entries[selectedIndex]
		focusedColumns.set(selectedIndex, choice)
		const targetVersion = getChoiceVersion(entry, choice)
		if (!isRegistryDependency(entry.declaredVersion)) {
			status = dim(`${entry.name} uses a local or aliased spec and cannot be changed safely.`)
		} else if (targetVersion === undefined) {
			status = dim(`${entry.name}: ${getChoiceError(entry, choice)}.`)
		} else if (targetVersion === entry.declaredVersion) {
			stagedChanges.delete(selectedIndex)
			status = dim(`${entry.name} already declares ${targetVersion}.`)
		} else {
			stagedChanges.set(selectedIndex, {
				entryIndex: selectedIndex,
				name: entry.name,
				from: entry.declaredVersion,
				to: targetVersion,
				kind: choice
			})
			status = `${entry.name} ${dim(`${entry.declaredVersion} → ${targetVersion} staged`)}`
		}
	}

	const render = (): void => {
		clearRenderedLines(renderedLineCount)
		const lines =
			screen === 'dependencies'
				? buildDependencyScreen(entries, targetPackage, selectedIndex, stagedChanges, status, focusedColumns, query)
				: buildReviewScreen(stagedChanges, reviewOffset)
		process.stderr.write(lines.join('\n'))
		renderedLineCount = lines.length
	}

	try {
		render()

		for (;;) {
			const { input, key } = await keypressQueue.read()
			if (key.ctrl === true && key.name === 'c') break

			const pageSize = Math.max(1, (process.stderr.rows ?? 24) - 9)

			if (screen === 'review') {
				const changes = listStagedChanges(stagedChanges)
				const reviewPageSize = Math.max(1, (process.stderr.rows ?? 24) - 4)
				const maximumOffset = Math.max(0, changes.length - reviewPageSize)

				if (key.name === 'escape') {
					screen = 'dependencies'
					status = ''
					render()
					continue
				}
				if (key.name === 'up' || input === 'k') reviewOffset = Math.max(0, reviewOffset - 1)
				else if (key.name === 'down' || input === 'j') reviewOffset = Math.min(maximumOffset, reviewOffset + 1)
				else if (key.name === 'pageup') reviewOffset = Math.max(0, reviewOffset - reviewPageSize)
				else if (key.name === 'pagedown') reviewOffset = Math.min(maximumOffset, reviewOffset + reviewPageSize)
				else if (key.name === 'return') {
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
				render()
				continue
			}

			if (key.name === 'escape') {
				if (query.length === 0) break
				query = ''
				status = ''
				render()
				continue
			}

			const filteredEntryIndexes = listFilteredDependencyIndexes(entries, query)
			const selectedFilteredIndex = Math.max(0, filteredEntryIndexes.indexOf(selectedIndex))
			if (key.name === 'up') {
				const nextFilteredIndex = Math.max(0, selectedFilteredIndex - 1)
				if (filteredEntryIndexes[nextFilteredIndex] !== undefined) selectedIndex = filteredEntryIndexes[nextFilteredIndex]
				status = ''
				render()
				continue
			}
			if (key.name === 'down') {
				const nextFilteredIndex = Math.min(filteredEntryIndexes.length - 1, selectedFilteredIndex + 1)
				if (filteredEntryIndexes[nextFilteredIndex] !== undefined) selectedIndex = filteredEntryIndexes[nextFilteredIndex]
				status = ''
				render()
				continue
			}
			if (key.name === 'pageup') {
				const nextFilteredIndex = Math.max(0, selectedFilteredIndex - pageSize)
				if (filteredEntryIndexes[nextFilteredIndex] !== undefined) selectedIndex = filteredEntryIndexes[nextFilteredIndex]
				status = ''
				render()
				continue
			}
			if (key.name === 'pagedown') {
				const nextFilteredIndex = Math.min(filteredEntryIndexes.length - 1, selectedFilteredIndex + pageSize)
				if (filteredEntryIndexes[nextFilteredIndex] !== undefined) selectedIndex = filteredEntryIndexes[nextFilteredIndex]
				status = ''
				render()
				continue
			}
			if (key.name === 'backspace') {
				query = removeLastCharacter(query)
				const matches = listFilteredDependencyIndexes(entries, query)
				if (matches[0] !== undefined) selectedIndex = matches[0]
				status = ''
				render()
				continue
			}
			if (isPrintableInput(input, key)) {
				query += input ?? ''
				const matches = listFilteredDependencyIndexes(entries, query)
				if (matches[0] !== undefined) selectedIndex = matches[0]
				status = ''
				render()
				continue
			}
			if (key.name === 'left' || key.name === 'right') {
				if (filteredEntryIndexes.length === 0) {
					render()
					continue
				}
				const entry = entries[selectedIndex]
				if (!isRegistryDependency(entry.declaredVersion)) {
					status = dim(`${entry.name} uses a local or aliased spec and cannot be changed safely.`)
				} else {
					const choices = listVersionTrackChoices(entry)
					const currentColumn = focusedColumns.get(selectedIndex) ?? 'declared'
					const direction = key.name === 'right' ? 1 : -1
					const nextColumn = moveVersionColumn(entry, currentColumn, direction)
					const nextChoice = choices.find(choice => choice.kind === nextColumn) ?? choices[0]

					focusedColumns.set(selectedIndex, nextChoice.kind)
					if (nextChoice.kind === currentColumn) {
						status = ''
					} else if (nextChoice.kind === 'declared') {
						stagedChanges.delete(selectedIndex)
						status = dim(`${entry.name} restored to declared ${entry.declaredVersion}.`)
					} else {
						stageChoice(nextChoice.kind)
					}
				}
				render()
				continue
			}

			if (key.name === 'return') {
				if (stagedChanges.size === 0) {
					status = dim('No changes are staged.')
				} else {
					screen = 'review'
					reviewOffset = 0
				}
				render()
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
