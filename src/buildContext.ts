import path from 'node:path'
import { findWorkspace } from './findWorkspace.js'
import { findNearestPackageDirectory, readPackageJsonInDirectory } from './readPackage.js'
import type { ContextT, TargetPackageT } from './types.js'

const findPackageForDirectory = (packages: TargetPackageT[], directory: string): TargetPackageT | undefined => {
	const resolvedDirectory = path.resolve(directory)

	return packages.find(candidatePackage => {
		return path.resolve(candidatePackage.directory) === resolvedDirectory
	})
}

const toPosixPath = (value: string): string => {
	return value.split('\\').join('/')
}

// A package.json the workspace patterns do not cover is still
// where the developer is standing, so it still leads the menu.
const buildUnlistedPackage = (packageDirectory: string, rootDirectory: string): TargetPackageT => {
	const packageJson = readPackageJsonInDirectory(packageDirectory)
	const relativePath = toPosixPath(path.relative(rootDirectory, packageDirectory))
	const fallbackName = path.basename(packageDirectory)

	const scriptsByName = packageJson?.scripts ?? {}
	return {
		name: packageJson?.name ?? fallbackName,
		directory: packageDirectory,
		relativePath: relativePath || '.',
		isRoot: false,
		scriptsByName,
		scriptDescriptionsByName: {}
	}
}

// Everything downstream needs the same three facts: what the
// workspace contains, which package the developer is standing in,
// and whether this is a workspace at all.
export const buildContext = (workingDirectory: string): ContextT => {
	const packageDirectory = findNearestPackageDirectory(workingDirectory)
	const hasNoPackage = packageDirectory === undefined

	if (hasNoPackage) {
		throw new Error('no package.json found in this directory or any parent.')
	}

	const workspace = findWorkspace(packageDirectory)
	const matchedPackage = findPackageForDirectory(workspace.packages, packageDirectory)
	const currentPackage = matchedPackage ?? buildUnlistedPackage(packageDirectory, workspace.rootDirectory)
	const isWorkspace = workspace.packages.length > 1

	return { workspace, currentPackage, isWorkspace }
}
