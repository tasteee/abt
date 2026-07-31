export type ErrorCategoryT = 'usage' | 'cancelled' | 'environment' | 'runtime';
export declare class CliError extends Error {
    readonly category: ErrorCategoryT;
    readonly code: string;
    readonly exitCode: number;
    readonly recovery?: string;
    constructor(options: {
        message: string;
        category?: ErrorCategoryT;
        code?: string;
        exitCode?: number;
        recovery?: string;
    });
}
export declare class CancelledError extends CliError {
    constructor();
}
export declare const usageError: (message: string, recovery?: string) => CliError;
