import type { ParsedArgumentsT } from './types.js';
export type ArgumentSplitT = {
    parsed: ParsedArgumentsT;
    forwardedArguments: string[];
};
export declare const parseArguments: (rawArguments: string[]) => ArgumentSplitT;
