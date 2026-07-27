import type { TargetPackageT } from './types.js';
export declare const stripScope: (packageName: string) => string;
export declare const buildShortName: (targetPackage: TargetPackageT) => string;
export declare const compareByShortName: (left: TargetPackageT, right: TargetPackageT) => number;
