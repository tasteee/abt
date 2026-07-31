import readline from 'node:readline'
import { CancelledError } from './errors.js'
import { fuzzyFilter } from './fuzzy.js'
import { LiveTerminal } from './liveTerminal.js'
import { accent, dim, getTerminalRows, getTerminalWidth, symbols, truncate } from './theme.js'

export type FuzzySelectItemT = {
	label: string
	alternateLabel?: string
	searchText: string
	value: string
}

export type FuzzySelectOutcomeT =
	| { kind: 'selected'; value: string }
	| { kind: 'back' }
	| { kind: 'tab' }
	| { kind: 'cancelled' }

type KeypressT = { input: string | undefined; key: readline.Key }

const createKeypressQueue = () => {
	const queuedKeypresses: KeypressT[] = []
	let waitingReader: ((keypress: KeypressT) => void) | undefined

	const enqueue = (keypress: KeypressT): void => {
		if (waitingReader === undefined) queuedKeypresses.push(keypress)
		else {
			const resolve = waitingReader
			waitingReader = undefined
			resolve(keypress)
		}
	}
	const handleKeypress = (input: string | undefined, key: readline.Key): void => enqueue({ input, key })

	process.stdin.on('keypress', handleKeypress)
	return {
		read: async (): Promise<KeypressT> => {
			const queued = queuedKeypresses.shift()
			if (queued !== undefined) return queued
			return await new Promise(resolve => {
				waitingReader = resolve
			})
		},
		cancel: () => enqueue({ input: undefined, key: { name: 'c', ctrl: true } }),
		dispose: () => process.stdin.off('keypress', handleKeypress)
	}
}

export const isPrintableFuzzyInput = (input: string | undefined, key: readline.Key): boolean => {
	if (key.ctrl === true || key.meta === true || input === undefined || input.length === 0) return false
	return [...input].every(character => {
		const characterCode = character.codePointAt(0) ?? 0
		return characterCode >= 32 && characterCode !== 127
	})
}

const removeLastCharacter = (value: string): string => [...value].slice(0, -1).join('')

export const chooseDetailMode = (showsCommands: boolean, keyName: string | undefined): boolean => {
	if (keyName === 'right') return true
	if (keyName === 'left') return false
	return showsCommands
}

export const shouldTriggerTabAction = (keyName: string | undefined, tabActionLabel: string | undefined): boolean => {
	return keyName === 'tab' && tabActionLabel !== undefined
}

const buildVisibleItems = <T>(items: T[], selectedIndex: number, pageSize: number): T[] => {
	let startIndex = Math.max(0, selectedIndex - Math.floor(pageSize / 2))
	startIndex = Math.min(startIndex, Math.max(0, items.length - pageSize))
	return items.slice(startIndex, startIndex + pageSize)
}

export const runFuzzySelect = async (config: {
	title: string
	items: FuzzySelectItemT[]
	canGoBack?: boolean
	tabActionLabel?: string
}): Promise<FuzzySelectOutcomeT> => {
	const keypressQueue = createKeypressQueue()
	const terminal = new LiveTerminal()
	terminal.start()

	let query = ''
	let selectedIndex = 0
	let showsCommands = false
	const handleResize = (): void => render()
	const handleSignal = (): void => keypressQueue.cancel()

	const listMatches = (): FuzzySelectItemT[] => fuzzyFilter(config.items, query, item => item.searchText)

	const render = (): void => {
		const matches = listMatches()
		selectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, matches.length - 1)))
		const pageSize = Math.max(1, getTerminalRows() - 4)
		const visibleItems = buildVisibleItems(matches, selectedIndex, pageSize)
		const firstVisibleIndex = visibleItems.length === 0 ? 0 : matches.indexOf(visibleItems[0])
		const width = getTerminalWidth()
		const marks = symbols()
		const filterText = query.length === 0 ? dim(`(type to filter${marks.range === '–' ? '…' : '...'})`) : query
		const lines = [truncate(config.title, width), `${dim('filter:')} ${filterText}`]

		if (visibleItems.length === 0) lines.push(dim(`  no matches for ${JSON.stringify(query)}`))
		else {
			visibleItems.forEach((item, visibleIndex) => {
				const itemIndex = firstVisibleIndex + visibleIndex
				const cursor = itemIndex === selectedIndex ? accent(marks.cursor) : ' '
				const displayedLabel = showsCommands ? (item.alternateLabel ?? item.label) : item.label
				const label = itemIndex === selectedIndex ? displayedLabel : dim(displayedLabel)
				lines.push(truncate(`${cursor} ${label}`, width))
			})
		}

		const resultRange =
			matches.length > pageSize
				? ` ${marks.bullet} ${firstVisibleIndex + 1}${marks.range}${firstVisibleIndex + visibleItems.length} of ${matches.length}`
				: ''
		const backLabel = query.length > 0 ? 'esc clear' : config.canGoBack === true ? 'esc back' : 'esc cancel'
		const tabLabel = config.tabActionLabel === undefined ? '' : ` ${marks.bullet} tab ${config.tabActionLabel}`
		const canSwitchDetails = config.items.some(item => item.alternateLabel !== undefined && item.alternateLabel !== item.label)
		const detailLabel = canSwitchDetails
			? ` ${marks.bullet} ${showsCommands ? `${marks.left} descriptions` : `${marks.right} commands`}`
			: ''
		lines.push(
			dim(
				truncate(
					`${marks.upDown} move ${marks.bullet} enter select${detailLabel} ${marks.bullet} ${backLabel}${tabLabel}${resultRange}`,
					width
				)
			)
		)
		terminal.render(lines)
	}

	try {
		process.stderr.on('resize', handleResize)
		process.once('SIGINT', handleSignal)
		process.once('SIGTERM', handleSignal)
		render()
		for (;;) {
			const { input, key } = await keypressQueue.read()
			if (key.ctrl === true && key.name === 'c') throw new CancelledError()

			if (key.name === 'escape') {
				if (query.length > 0) {
					query = ''
					selectedIndex = 0
					render()
					continue
				}
				return config.canGoBack === true ? { kind: 'back' } : { kind: 'cancelled' }
			}

			if (shouldTriggerTabAction(key.name, config.tabActionLabel)) return { kind: 'tab' }
			if (key.name === 'right' && config.items.some(item => item.alternateLabel !== undefined)) {
				showsCommands = chooseDetailMode(showsCommands, key.name)
				render()
				continue
			}
			if (key.name === 'left' && config.items.some(item => item.alternateLabel !== undefined)) {
				showsCommands = chooseDetailMode(showsCommands, key.name)
				render()
				continue
			}

			const matches = listMatches()
			if (key.name === 'up') {
				selectedIndex = Math.max(0, selectedIndex - 1)
				render()
				continue
			}
			if (key.name === 'down') {
				selectedIndex = Math.max(0, Math.min(matches.length - 1, selectedIndex + 1))
				render()
				continue
			}
			if (key.name === 'pageup') {
				selectedIndex = Math.max(0, selectedIndex - Math.max(1, getTerminalRows() - 4))
				render()
				continue
			}
			if (key.name === 'pagedown') {
				selectedIndex = Math.max(
					0,
					Math.min(matches.length - 1, selectedIndex + Math.max(1, getTerminalRows() - 4))
				)
				render()
				continue
			}
			if ((key.name === 'return' || key.name === 'enter') && matches[selectedIndex] !== undefined) {
				return { kind: 'selected', value: matches[selectedIndex].value }
			}
			if (key.name === 'backspace') {
				query = removeLastCharacter(query)
				selectedIndex = 0
				render()
				continue
			}
			if (isPrintableFuzzyInput(input, key)) {
				query += input ?? ''
				selectedIndex = 0
				render()
			}
		}
	} finally {
		process.stderr.off('resize', handleResize)
		process.off('SIGINT', handleSignal)
		process.off('SIGTERM', handleSignal)
		keypressQueue.dispose()
		terminal.dispose()
	}
}
