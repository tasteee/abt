import type { FuzzySelectOutcomeT } from './fuzzySelect.js';
import type { CliRendererT } from './renderer.js';
import type { ContextT, TargetPackageT } from './types.js';
export declare const buildScriptHeader: (targetPackage: TargetPackageT) => string;
export declare const buildPackageHeader: (targetPackage: TargetPackageT) => string;
export type FlowOutcomeT = {
    exitCode: number;
    wasCancelled: boolean;
};
export declare const shouldReturnFromPackagePicker: (outcomeKind: FuzzySelectOutcomeT['kind']) => boolean;
export declare const runInteractiveFlow: (context: ContextT, forwardedArguments: string[], renderer: CliRendererT, header?: string) => Promise<FlowOutcomeT>;
export declare const runPackageScriptFlow: (context: ContextT, targetPackage: TargetPackageT, forwardedArguments: string[], renderer: CliRendererT) => Promise<FlowOutcomeT>;
