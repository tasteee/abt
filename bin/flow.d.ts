import type { ContextT, TargetPackageT } from './types.js';
export type FlowOutcomeT = {
    exitCode: number;
    wasCancelled: boolean;
};
export declare const runInteractiveFlow: (context: ContextT, forwardedArguments: string[], header?: string) => Promise<FlowOutcomeT>;
export declare const runPackageScriptFlow: (context: ContextT, targetPackage: TargetPackageT, forwardedArguments: string[]) => Promise<FlowOutcomeT>;
