import type { DependencyEntryT, TargetPackageT } from './types.js';
type DependencyChangeT = {
    name: string;
    from: string;
    to: string;
};
type StagedChangeT = DependencyChangeT & {
    entryIndex: number;
    kind: 'pin' | 'latest';
    isMajor: boolean;
};
export declare const isMajorUpgrade: (declaredVersion: string, latestVersion: string) => boolean;
export declare const buildDependencyScreen: (entries: DependencyEntryT[], targetPackage: TargetPackageT, selectedIndex: number, stagedChanges: Map<number, StagedChangeT>, status: string) => string[];
export declare const runDependencyFlow: (entries: DependencyEntryT[], targetPackage: TargetPackageT) => Promise<DependencyChangeT[]>;
export {};
