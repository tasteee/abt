import path from 'node:path'
import fs from 'node:fs'
import type { ScriptsByNameT } from './types.js'

export type PackageJsonT = {
	name?: string
	scripts?: ScriptsByNameT
	workspaces?: string[] | { packages?: string[] }
}

// A package.json that exists but does not parse is a real problem
// worth naming, not something to skip past silently.
export const readPackageJson = (packageJsonPath: string): PackageJsonT | undefined => {
	const doesExist = fs.existsSync(packageJsonPath)
	if (!doesExist) return undefined

	const rawContents = fs.readFileSync(packageJsonPath, 'utf-8')

	try {
		return JSON.parse(rawContents) as PackageJsonT
	} catch {
		const displayPath = path.relative(process.cwd(), packageJsonPath) || packageJsonPath
		throw new Error(`${displayPath} is not valid JSON.`)
	}
}

export const readPackageJsonInDirectory = (directory: string): PackageJsonT | undefined => {
	return readPackageJson(path.join(directory, 'package.json'))
}

// Every directory from the starting point up to the filesystem
// root, nearest first.
export const listAncestorDirectories = (startDirectory: string): string[] => {
	const ancestors: string[] = []
	let currentDirectory = path.resolve(startDirectory)

	for (;;) {
		ancestors.push(currentDirectory)

		const parentDirectory = path.dirname(currentDirectory)
		const hasReachedFilesystemRoot = parentDirectory === currentDirectory
		if (hasReachedFilesystemRoot) return ancestors

		currentDirectory = parentDirectory
	}
}

export const findNearestPackageDirectory = (startDirectory: string): string | undefined => {
	const ancestors = listAncestorDirectories(startDirectory)

	return ancestors.find(ancestorDirectory => {
		return fs.existsSync(path.join(ancestorDirectory, 'package.json'))
	})
}
