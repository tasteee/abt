export declare const PackageManager: {
    readonly npm: 'npm';
    readonly pnpm: 'pnpm';
    readonly yarn: 'yarn';
    readonly bun: 'bun';
};
export type PackageManagerT = (typeof PackageManager)[keyof typeof PackageManager];
export declare const detectPackageManager: (rootDirectory: string) => PackageManagerT;
