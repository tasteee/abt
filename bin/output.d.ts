import type { CliEnvironmentT } from './environment.js';
import type { CliError } from './errors.js';
export declare const configureOutput: (environment: CliEnvironmentT) => void;
export declare const writeResult: (text: string) => void;
export declare const writeDiagnostic: (text: string) => void;
export declare const writeJsonResult: (result: Record<string, unknown>) => void;
export declare const writeJsonError: (error: CliError) => void;
