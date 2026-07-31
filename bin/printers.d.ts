import type { ContextT } from './types.js';
export declare const printVersion: (version: string) => void;
export declare const printHelp: (version: string) => void;
export type ScriptListEntryT = {
    package: string;
    name: string;
    command: string;
    qualifiedName: string;
};
export declare const listScripts: (context: ContextT) => ScriptListEntryT[];
export declare const printScriptList: (context: ContextT) => void;
export declare const printError: (message: string) => void;
