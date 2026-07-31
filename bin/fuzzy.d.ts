export type FuzzyMatchT<T> = {
    item: T;
    score: number;
    originalIndex: number;
};
export declare const fuzzyScore: (candidateValue: string, queryValue: string) => number | undefined;
export declare const fuzzyFilter: <T>(items: T[], query: string, readSearchText: (item: T) => string) => T[];
