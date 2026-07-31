import type { CliEnvironmentT } from './environment.js';
import type { DependencyEntryT, DependencySectionT } from './types.js';
export type ScriptResultT = {
    package: string;
    name: string;
    command: string;
    qualifiedName: string;
};
export type DependencyChangeResultT = {
    name: string;
    section: DependencySectionT;
    from: string;
    to: string;
    lane?: 'installed' | 'major' | 'latest';
};
export type CliEventT = {
    type: 'operation:start';
    id: string;
    title: string;
} | {
    type: 'operation:complete';
    id: string;
} | {
    type: 'command:run';
    description: string;
} | {
    type: 'version';
    version: string;
} | {
    type: 'script:list';
    scripts: ScriptResultT[];
} | {
    type: 'dependency:report';
    package: string;
    dependencies: DependencyEntryT[];
} | {
    type: 'dependency:empty';
    package: string;
} | {
    type: 'dependency:changed';
    package: string;
    dryRun: boolean;
    changes: DependencyChangeResultT[];
} | {
    type: 'notice';
    level: 'info' | 'warning' | 'error';
    title: string;
    body?: string;
    verboseOnly?: boolean;
};
export interface CliRendererT {
    emit(event: CliEventT): void;
    flush(): Promise<void>;
    dispose(): Promise<void>;
}
export declare class PlainRenderer implements CliRendererT {
    protected readonly environment: CliEnvironmentT;
    constructor(environment: CliEnvironmentT);
    emit(event: CliEventT): void;
    flush(): Promise<void>;
    dispose(): Promise<void>;
}
export declare class InteractiveRenderer extends PlainRenderer {
    private transientId;
    emit(event: CliEventT): void;
    dispose(): Promise<void>;
}
export declare class JsonRenderer implements CliRendererT {
    private result;
    emit(event: CliEventT): void;
    flush(): Promise<void>;
    dispose(): Promise<void>;
}
export declare class SilentRenderer extends PlainRenderer {
}
export declare class TestRenderer implements CliRendererT {
    readonly events: CliEventT[];
    emit(event: CliEventT): void;
    flush(): Promise<void>;
    dispose(): Promise<void>;
}
export declare const createRenderer: (environment: CliEnvironmentT) => CliRendererT;
