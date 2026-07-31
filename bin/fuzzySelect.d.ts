import readline from 'node:readline';
export type FuzzySelectItemT = {
    label: string;
    alternateLabel?: string;
    searchText: string;
    value: string;
};
export type FuzzySelectOutcomeT = {
    kind: 'selected';
    value: string;
} | {
    kind: 'back';
} | {
    kind: 'tab';
} | {
    kind: 'cancelled';
};
export declare const isPrintableFuzzyInput: (input: string | undefined, key: readline.Key) => boolean;
export declare const chooseDetailMode: (showsCommands: boolean, keyName: string | undefined) => boolean;
export declare const runFuzzySelect: (config: {
    title: string;
    items: FuzzySelectItemT[];
    canGoBack?: boolean;
    canOpenPackages?: boolean;
}) => Promise<FuzzySelectOutcomeT>;
