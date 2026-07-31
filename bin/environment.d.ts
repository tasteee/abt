import type { ParsedArgumentsT } from './types.js';
export type CliEnvironmentT = {
    interactive: boolean;
    color: boolean;
    unicode: boolean;
    json: boolean;
    quiet: boolean;
    verbose: boolean;
    debug: boolean;
    columns: number | undefined;
    rows: number | undefined;
    ci: boolean;
};
export declare const detectEnvironment: (parsed: ParsedArgumentsT, options?: {
    stdinTTY?: boolean;
    stdoutTTY?: boolean;
    stderrTTY?: boolean;
    columns?: number;
    rows?: number;
    environment?: NodeJS.ProcessEnv;
}) => CliEnvironmentT;
