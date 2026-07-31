export declare class LiveTerminal {
    private renderedLineCount;
    private wasRaw;
    private started;
    private readonly input;
    private readonly output;
    constructor(input?: NodeJS.ReadStream, output?: NodeJS.WriteStream);
    start(): void;
    render(lines: string[]): void;
    private clear;
    dispose(): void;
}
