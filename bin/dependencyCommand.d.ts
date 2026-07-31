import type { CliRendererT } from './renderer.js';
import type { ContextT, DependencyEntryT, DependencySectionT } from './types.js';
type UpdateLaneT = 'installed' | 'major' | 'latest';
export type DependencyCommandOptionsT = {
    interactive: boolean;
    dryRun: boolean;
    updates: string[];
    renderer: CliRendererT;
};
type DependencyChangeT = {
    name: string;
    section: DependencySectionT;
    from: string;
    to: string;
    lane: UpdateLaneT;
};
export declare const resolveDependencyUpdates: (entries: DependencyEntryT[], requested: string[]) => DependencyChangeT[];
export declare const runDependencyCommand: (context: ContextT, packageArguments: string[], options: DependencyCommandOptionsT) => Promise<number>;
export {};
