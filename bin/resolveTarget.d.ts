import type { ContextT, TargetPackageT } from './types.js';
export declare const findPackageByName: (context: ContextT, typedName: string) => TargetPackageT | undefined;
export declare const listPackageDisplayNames: (context: ContextT) => string[];
export type ResolutionT = {
    kind: 'run';
    targetPackage: TargetPackageT;
    scriptName: string;
} | {
    kind: 'open';
    targetPackage: TargetPackageT;
} | {
    kind: 'unknownScript';
    targetPackage: TargetPackageT;
    typedName: string;
    suggestion?: string;
} | {
    kind: 'unknownPackage';
    typedName: string;
    suggestion?: string;
};
export declare const resolveTarget: (context: ContextT, positionals: string[]) => ResolutionT | undefined;
