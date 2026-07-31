import picocolors from 'picocolors'
import type { CliEnvironmentT } from './environment.js'

// One accent, used only for the cursor and the tool's own name.
// Everything else earns hierarchy from dimming and alignment.
let colors = picocolors.createColors(false)
let terminalWidth: number | undefined
let terminalRows: number | undefined
let usesUnicode = true

export const configureTheme = (environment: CliEnvironmentT): void => {
	colors = picocolors.createColors(environment.color)
	terminalWidth = environment.columns
	terminalRows = environment.rows
	usesUnicode = environment.unicode
}

export const accent = (value: string): string => colors.cyan(value)
export const dim = (value: string): string => colors.dim(value)
export const bold = (value: string): string => colors.bold(value)
export const highlight = (value: string): string => colors.inverse(value)

export const drillSymbol = (): string => (usesUnicode ? '›' : '>')
export const ellipsis = (): string => (usesUnicode ? '…' : '...')
export const symbols = () => ({
	drill: usesUnicode ? '›' : '>',
	delta: usesUnicode ? '∆' : 'deps',
	cursor: usesUnicode ? '❯' : '>',
	arrow: usesUnicode ? '→' : '->',
	leftRight: usesUnicode ? '←→' : '<->',
	upDown: usesUnicode ? '↑↓' : 'up/down',
	bullet: usesUnicode ? '·' : '-',
	range: usesUnicode ? '–' : '-',
	divider: usesUnicode ? '│' : '|',
	missing: usesUnicode ? '—' : '-'
})

const FALLBACK_TERMINAL_WIDTH = 80
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
export const getTerminalWidth = (): number => {
	const liveWidth = process.stderr.isTTY === true ? process.stderr.columns : undefined
	return Math.max(1, liveWidth ?? terminalWidth ?? FALLBACK_TERMINAL_WIDTH)
}

export const getTerminalRows = (): number => {
	const liveRows = process.stderr.isTTY === true ? process.stderr.rows : undefined
	return Math.max(1, liveRows ?? terminalRows ?? 24)
}

// Collapse whitespace so a multi-line script reads as one row.
export const flattenCommand = (command: string): string => {
	return command.split(/\s+/).join(' ').trim()
}

export const truncate = (text: string, maximumLength: number): string => {
	const plainText = text.replace(ANSI_PATTERN, '')
	const fitsAlready = plainText.length <= maximumLength
	if (fitsAlready) return text

	const isTooNarrowToTruncate = maximumLength <= 1
	if (maximumLength <= 0) return ''
	if (isTooNarrowToTruncate) return ellipsis().slice(0, maximumLength)

	const suffix = ellipsis()
	if (suffix.length >= maximumLength) return suffix.slice(0, maximumLength)
	return `${plainText.slice(0, maximumLength - suffix.length)}${suffix}`
}
