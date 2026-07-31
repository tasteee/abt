import picocolors from 'picocolors'

// One accent, used only for the cursor and the tool's own name.
// Everything else earns hierarchy from dimming and alignment.
export const accent = picocolors.cyan
export const dim = picocolors.dim
export const bold = picocolors.bold
export const highlight = picocolors.inverse

export const drillSymbol = '›'
export const ellipsis = '…'

const FALLBACK_TERMINAL_WIDTH = 80
const MINIMUM_TERMINAL_WIDTH = 40

export const getTerminalWidth = (): number => {
	const reportedWidth = process.stderr.columns ?? FALLBACK_TERMINAL_WIDTH
	const isUsableWidth = reportedWidth >= MINIMUM_TERMINAL_WIDTH
	if (!isUsableWidth) return MINIMUM_TERMINAL_WIDTH
	return reportedWidth
}

// Collapse whitespace so a multi-line script reads as one row.
export const flattenCommand = (command: string): string => {
	return command.split(/\s+/).join(' ').trim()
}

export const truncate = (text: string, maximumLength: number): string => {
	const fitsAlready = text.length <= maximumLength
	if (fitsAlready) return text

	const isTooNarrowToTruncate = maximumLength <= 1
	if (isTooNarrowToTruncate) return ellipsis

	return `${text.slice(0, maximumLength - 1)}${ellipsis}`
}
