import path from 'node:path'
import fs from 'node:fs'
import { expandPackageGlobs } from './expandPackageGlobs.js'
import { compareByShortName } from './packageNames.js'
import { listAncestorDirectories, readPackageJsonInDirectory } from './readPackage.js'
import type { PackageJsonT } from './readPackage.js'
import type { TargetPackageT, WorkspaceT } from './types.js'

const PNPM_WORKSPACE_FILENAME = 'pnpm-workspace.yaml'
const PNPM_WORKSPACE_ALTERNATE_FILENAME = 'pnpm-workspace.yml'

// pnpm-workspace.yaml is read directly rather than through a YAML
// dependency: the only key abt needs is a flat list of strings
// under `packages:`, and a parser is not worth the startup cost.
const readPnpmWorkspacePatterns = (workspaceFilePath: string): string[] => {
	const rawContents = fs.readFileSync(workspaceFilePath, 'utf-8')
	const lines = rawContents.split(/\r?\n/)

	const packagesKeyIndex = lines.findIndex(line => line.trimEnd() === 'packages:')
	const hasNoPackagesKey = packagesKeyIndex === -1
	if (hasNoPackagesKey) return []

	const linesAfterKey = lines.slice(packagesKeyIndex + 1)
	const patterns: string[] = []

	for (const line of linesAfterKey) {
		const trimmedLine = line.trim()

		const isBlank = trimmedLine.length === 0
		if (isBlank) continue

		const isComment = trimmedLine.startsWith('#')
		if (isComment) continue

		const isListItem = trimmedLine.startsWith('- ')
		if (!isListItem) break

		const rawValue = trimmedLine.slice(2).trim()
		const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '')
		patterns.push(unquotedValue)
	}

	return patterns
}

const readWorkspacePatternsFromPackageJson = (packageJson: PackageJsonT | undefined): string[] => {
	const workspaces = packageJson?.workspaces
	const hasNoWorkspaces = workspaces === undefined
	if (hasNoWorkspaces) return []

	const isPatternArray = Array.isArray(workspaces)
	if (isPatternArray) return workspaces

	return workspaces.packages ?? []
}

const findPnpmWorkspaceFile = (directory: string): string | undefined => {
	const primaryPath = path.join(directory, PNPM_WORKSPACE_FILENAME)
	const hasPrimary = fs.existsSync(primaryPath)
	if (hasPrimary) return primaryPath

	const alternatePath = path.join(directory, PNPM_WORKSPACE_ALTERNATE_FILENAME)
	const hasAlternate = fs.existsSync(alternatePath)
	if (hasAlternate) return alternatePath

	return undefined
}

const readWorkspacePatterns = (directory: string): string[] => {
	const pnpmWorkspaceFile = findPnpmWorkspaceFile(directory)

	if (pnpmWorkspaceFile !== undefined) {
		const pnpmPatterns = readPnpmWorkspacePatterns(pnpmWorkspaceFile)
		const hasPnpmPatterns = pnpmPatterns.length > 0
		if (hasPnpmPatterns) return pnpmPatterns
	}

	const packageJson = readPackageJsonInDirectory(directory)
	return readWorkspacePatternsFromPackageJson(packageJson)
}

type WorkspaceRootT = {
	directory: string
	patterns: string[]
}

// The nearest ancestor that declares workspace packages wins. A
// repo checked out inside another workspace belongs to itself, not
// to whatever happens to sit above it on disk.
const findWorkspaceRoot = (startDirectory: string): WorkspaceRootT | undefined => {
	const ancestors = listAncestorDirectories(startDirectory)

	const declaringRoots = ancestors.flatMap(ancestorDirectory => {
		const patterns = readWorkspacePatterns(ancestorDirectory)
		const hasPatterns = patterns.length > 0
		if (!hasPatterns) return []

		return [{ directory: ancestorDirectory, patterns }]
	})

	return declaringRoots[0]
}

const buildTargetPackage = (directory: string, rootDirectory: string, isRoot: boolean): TargetPackageT | undefined => {
	const packageJson = readPackageJsonInDirectory(directory)
	const hasNoPackageJson = packageJson === undefined
	if (hasNoPackageJson) return undefined

	const relativePath = path.relative(rootDirectory, directory).split('\\').join('/')
	const fallbackName = relativePath || path.basename(directory)

	return {
		name: packageJson.name ?? fallbackName,
		directory,
		relativePath: relativePath || '.',
		isRoot,
		scriptsByName: packageJson.scripts ?? {}
	}
}

// Build the full picture once: the root package plus every member
// package, each with its scripts already read.
export const findWorkspace = (packageDirectory: string): WorkspaceT => {
	const workspaceRoot = findWorkspaceRoot(packageDirectory)

	const hasNoWorkspace = workspaceRoot === undefined

	if (hasNoWorkspace) {
		const solePackage = buildTargetPackage(packageDirectory, packageDirectory, true)
		const packages = solePackage === undefined ? [] : [solePackage]
		return { rootDirectory: packageDirectory, packages }
	}

	const rootDirectory = workspaceRoot.directory
	const memberDirectories = expandPackageGlobs(rootDirectory, workspaceRoot.patterns)

	const rootPackage = buildTargetPackage(rootDirectory, rootDirectory, true)

	const memberPackages = memberDirectories.flatMap(memberDirectory => {
		const memberPackage = buildTargetPackage(memberDirectory, rootDirectory, false)
		if (memberPackage === undefined) return []
		return [memberPackage]
	})

	const sortedMembers = [...memberPackages].sort(compareByShortName)
	const hasRootPackage = rootPackage !== undefined
	const packages = hasRootPackage ? [rootPackage, ...sortedMembers] : sortedMembers

	return { rootDirectory, packages }
}
