import readline from 'node:readline'

export class LiveTerminal {
	private renderedLineCount = 0
	private wasRaw = false
	private started = false
	private readonly input: NodeJS.ReadStream
	private readonly output: NodeJS.WriteStream

	constructor(input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stderr) {
		this.input = input
		this.output = output
	}

	start(): void {
		if (this.started) return
		this.started = true
		readline.emitKeypressEvents(this.input)
		this.wasRaw = this.input.isRaw === true
		this.input.setRawMode(true)
		this.input.resume()
		this.output.write('\u001B[?25l')
	}

	render(lines: string[]): void {
		this.clear()
		this.output.write(lines.join('\n'))
		this.renderedLineCount = lines.length
	}

	private clear(): void {
		if (this.renderedLineCount === 0) return
		this.output.write('\r\u001B[2K')
		for (let index = 1; index < this.renderedLineCount; index += 1) {
			this.output.write('\u001B[1A\r\u001B[2K')
		}
	}

	dispose(): void {
		if (!this.started) return
		this.clear()
		this.renderedLineCount = 0
		this.output.write('\u001B[?25h')
		this.input.setRawMode(this.wasRaw)
		this.input.pause()
		this.started = false
	}
}
