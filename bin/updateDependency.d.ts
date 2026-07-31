import type { DependencySectionT } from './types.js';
export type DependencyVersionUpdateT = {
    section: DependencySectionT;
    packageName: string;
    currentVersion: string;
    nextVersion: string;
};
export declare const updateDependencyVersion: (packageDirectory: string, section: DependencySectionT, packageName: string, currentVersion: string, nextVersion: string) => void;
export declare const updateDependencyVersions: (packageDirectory: string, updates: DependencyVersionUpdateT[]) => void;
