import readline from 'node:readline'
import { fuzzyFilter } from './fuzzy.js'
import { accent, dim, getTerminalWidth, truncate } from './theme.js'

export type FuzzySelectItemT = {
	label: string
	searchText: string
	value: string
}

export type FuzzySelectOutcomeT =
	| { kind: 'selected'; value: string }
	| { kind: 'back' }
	| { kind: 'tab' }
	| { kind: 'cancelled' }

type KeypressT = { input: string | undefined; key: readline.Key }

const clearRenderedLines = (lineCount: number): void => {
	if (lineCount === 0) return
	process.stderr.write('\r\u001B[2K')
	for (let index = 1; index < lineCount; index += 1) process.stderr.write('\u001B[1A\r\u001B[2K')
}

const createKeypressQueue = () => {
	const queuedKeypresses: KeypressT[] = []
	let waitingReader: ((keypress: KeypressT) => void) | undefined

	const handleKeypress = (input: string | undefined, key: readline.Key): void => {
		const keypress = { input, key }
		if (waitingReader === undefined) queuedKeypresses.push(keypress)
		else {
			const resolve = waitingReader
			waitingReader = undefined
			resolve(keypress)
		}
	}

	process.stdin.on('keypress', handleKeypress)
	return {
		read: async (): Promise<KeypressT> => {
			const queued = queuedKeypresses.shift()
			if (queued !== undefined) return queued
			return await new Promise(resolve => {
				waitingReader = resolve
			})
		},
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

const buildVisibleItems = <T>(items: T[], selectedIndex: number, pageSize: number): T[] => {
	let startIndex = Math.max(0, selectedIndex - Math.floor(pageSize / 2))
	startIndex = Math.min(startIndex, Math.max(0, items.length - pageSize))
	return items.slice(startIndex, startIndex + pageSize)
}

export const runFuzzySelect = async (config: {
	title: string
	items: FuzzySelectItemT[]
	canGoBack?: boolean
	canOpenPackages?: boolean
}): Promise<FuzzySelectOutcomeT> => {
	readline.emitKeypressEvents(process.stdin)
	const keypressQueue = createKeypressQueue()
	const wasRaw = process.stdin.isRaw
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stderr.write('\u001B[?25l')

	let query = ''
	let selectedIndex = 0
	let renderedLineCount = 0

	const listMatches = (): FuzzySelectItemT[] => fuzzyFilter(config.items, query, item => item.searchText)

	const render = (): void => {
		clearRenderedLines(renderedLineCount)
		const matches = listMatches()
		selectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, matches.length - 1)))
		const pageSize = Math.max(1, (process.stderr.rows ?? 24) - 4)
		const visibleItems = buildVisibleItems(matches, selectedIndex, pageSize)
		const firstVisibleIndex = visibleItems.length === 0 ? 0 : matches.indexOf(visibleItems[0])
		const width = getTerminalWidth()
		const filterText = query.length === 0 ? dim('(type to filter…)') : query
		const lines = [truncate(config.title, width), `${dim('filter:')} ${filterText}`]

		if (visibleItems.length === 0) lines.push(dim(`  no matches for ${JSON.stringify(query)}`))
		else {
			visibleItems.forEach((item, visibleIndex) => {
				const itemIndex = firstVisibleIndex + visibleIndex
				const cursor = itemIndex === selectedIndex ? accent('❯') : ' '
				const label = itemIndex === selectedIndex ? item.label : dim(item.label)
				lines.push(`${cursor} ${label}`)
			})
		}

		const resultRange =
			matches.length > pageSize
				? ` · ${firstVisibleIndex + 1}–${firstVisibleIndex + visibleItems.length} of ${matches.length}`
				: ''
		const backLabel = query.length > 0 ? 'esc clear' : config.canGoBack === true ? 'esc back' : 'esc cancel'
		const packageLabel = config.canOpenPackages === true ? ' · tab packages' : ''
		lines.push(dim(truncate(`↑↓ move · enter select · ${backLabel}${packageLabel}${resultRange}`, width)))
		process.stderr.write(lines.join('\n'))
		renderedLineCount = lines.length
	}

	try {
		render()
		for (;;) {
			const { input, key } = await keypressQueue.read()
			if (key.ctrl === true && key.name === 'c') return { kind: 'cancelled' }

			if (key.name === 'escape') {
				if (query.length > 0) {
					query = ''
					selectedIndex = 0
					render()
					continue
				}
				return config.canGoBack === true ? { kind: 'back' } : { kind: 'cancelled' }
			}

			if (key.name === 'tab' && config.canOpenPackages === true) return { kind: 'tab' }

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
				selectedIndex = Math.max(0, selectedIndex - Math.max(1, (process.stderr.rows ?? 24) - 4))
				render()
				continue
			}
			if (key.name === 'pagedown') {
				selectedIndex = Math.max(
					0,
					Math.min(matches.length - 1, selectedIndex + Math.max(1, (process.stderr.rows ?? 24) - 4))
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
		keypressQueue.dispose()
		clearRenderedLines(renderedLineCount)
		process.stderr.write('\u001B[?25h')
		process.stdin.setRawMode(wasRaw === true)
		process.stdin.pause()
	}
}
