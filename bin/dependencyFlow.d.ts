import readline from 'node:readline';
import type { DependencyEntryT, TargetPackageT } from './types.js';
type DependencyChangeT = {
    name: string;
    from: string;
    to: string;
};
export type StagedChangeT = DependencyChangeT & {
    entryIndex: number;
    kind: 'installed' | 'major' | 'latest';
};
type VersionChoiceT = StagedChangeT['kind'];
export type VersionColumnT = 'declared' | VersionChoiceT;
type VersionTrackChoiceT = {
    kind: VersionColumnT;
    version: string | undefined;
};
export declare const isMajorUpgrade: (declaredVersion: string, latestVersion: string) => boolean;
export declare const listFilteredDependencyIndexes: (entries: DependencyEntryT[], query: string) => number[];
export declare const buildDependencyScreen: (entries: DependencyEntryT[], targetPackage: TargetPackageT, selectedIndex: number, stagedChanges: Map<number, StagedChangeT>, status: string, focusedColumns?: Map<number, VersionColumnT>, query?: string) => string[];
export declare const buildReviewScreen: (stagedChanges: Map<number, StagedChangeT>, offset?: number) => string[];
export declare const isPrintableInput: (input: string | undefined, key: readline.Key) => boolean;
export declare const listVersionTrackChoices: (entry: DependencyEntryT) => VersionTrackChoiceT[];
export declare const moveVersionColumn: (entry: DependencyEntryT, currentColumn: VersionColumnT, direction: -1 | 1) => VersionColumnT;
export declare const runDependencyFlow: (entries: DependencyEntryT[], targetPackage: TargetPackageT) => Promise<DependencyChangeT[]>;
export {};
