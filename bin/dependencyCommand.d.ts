import type { ContextT, DependencyEntryT } from './types.js';
export declare const printDependencyReport: (entries: DependencyEntryT[]) => void;
export declare const runDependencyCommand: (context: ContextT, packageArguments: string[], canPrompt: boolean) => Promise<number>;
