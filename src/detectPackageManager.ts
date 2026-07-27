import path from 'node:path'
import fs from 'node:fs'

export const PackageManager = {
	npm: 'npm',
	pnpm: 'pnpm',
	yarn: 'yarn',
	bun: 'bun'
} as const

export type PackageManagerT = (typeof PackageManager)[keyof typeof PackageManager]

const LOCKFILE_BY_MANAGER: Array<[PackageManagerT, string]> = [
	[PackageManager.pnpm, 'pnpm-lock.yaml'],
	[PackageManager.yarn, 'yarn.lock'],
	[PackageManager.bun, 'bun.lockb'],
	[PackageManager.bun, 'bun.lock'],
	[PackageManager.npm, 'package-lock.json']
]

// `packageManager: "pnpm@9.1.0"` is the declared intent when it
// exists, and outranks whatever lockfile happens to be lying around.
const readDeclaredPackageManager = (rootDirectory: string): PackageManagerT | undefined => {
	const packageJsonPath = path.join(rootDirectory, 'package.json')
	const doesExist = fs.existsSync(packageJsonPath)
	if (!doesExist) return undefined

	try {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
		const declaredValue = packageJson.packageManager
		const isDeclared = typeof declaredValue === 'string'
		if (!isDeclared) return undefined

		const declaredName = declaredValue.split('@')[0]
		const knownNames = Object.values(PackageManager) as string[]
		const isKnownName = knownNames.includes(declaredName)
		if (!isKnownName) return undefined

		return declaredName as PackageManagerT
	} catch {
		return undefined
	}
}

const findManagerByLockfile = (rootDirectory: string): PackageManagerT | undefined => {
	const match = LOCKFILE_BY_MANAGER.find(entry => {
		const lockfileName = entry[1]
		return fs.existsSync(path.join(rootDirectory, lockfileName))
	})

	if (match === undefined) return undefined
	return match[0]
}

// Lockfiles live at the workspace root, so detection is rooted
// there even when the script being run belongs to a child package.
export const detectPackageManager = (rootDirectory: string): PackageManagerT => {
	const declaredManager = readDeclaredPackageManager(rootDirectory)
	if (declaredManager !== undefined) return declaredManager

	const lockfileManager = findManagerByLockfile(rootDirectory)
	if (lockfileManager !== undefined) return lockfileManager

	return PackageManager.npm
}
