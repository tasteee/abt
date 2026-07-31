import type { TargetPackageT } from './types.js';
export declare const getHistoryFilePath: () => string;
export declare const listRecentScripts: (targetPackage: TargetPackageT, historyPath?: string) => string[];
export declare const recordScriptChoice: (targetPackage: TargetPackageT, scriptName: string, historyPath?: string) => void;
