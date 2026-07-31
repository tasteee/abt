import path from 'node:path'
import fs from 'node:fs'
import { DependencySection } from './types.js'
import type { DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js'
import type { PackageJsonT } from './readPackage.js'

const DEPENDENCY_SECTIONS: DependencySectionT[] = [
	DependencySection.dependencies,
	DependencySection.peerDependencies,
	DependencySection.devDependencies
]

export const listDependencySections = (): DependencySectionT[] => [...DEPENDENCY_SECTIONS]

export const isRegistryDependency = (declaredVersion: string): boolean => {
	if (declaredVersion.startsWith('workspace:')) return false
	if (declaredVersion.startsWith('file:')) return false
	if (declaredVersion.startsWith('link:')) return false
	if (declaredVersion.startsWith('git')) return false
	if (declaredVersion.startsWith('http:') || declaredVersion.startsWith('https:')) return false
	if (declaredVersion.startsWith('npm:')) return false
	return true
}

const packagePathParts = (packageName: string): string[] => packageName.split('/')

export const readInstalledVersion = (
	packageName: string,
	packageDirectory: string,
	workspaceRootDirectory: string
): string | undefined => {
	let candidateDirectory = path.resolve(packageDirectory)
	const resolvedWorkspaceRoot = path.resolve(workspaceRootDirectory)

	for (;;) {
		const installedPackagePath = path.join(candidateDirectory, 'node_modules', ...packagePathParts(packageName), 'package.json')

		if (fs.existsSync(installedPackagePath)) {
			try {
				const installedPackage = JSON.parse(fs.readFileSync(installedPackagePath, 'utf-8')) as { version?: unknown }
				if (typeof installedPackage.version === 'string') return installedPackage.version
			} catch {
				return undefined
			}
		}

		if (candidateDirectory === resolvedWorkspaceRoot) return undefined

		const parentDirectory = path.dirname(candidateDirectory)
		const leftWorkspace = !parentDirectory.startsWith(`${resolvedWorkspaceRoot}${path.sep}`) && parentDirectory !== resolvedWorkspaceRoot
		if (parentDirectory === candidateDirectory || leftWorkspace) return undefined
		candidateDirectory = parentDirectory
	}
}

export const buildDependencyEntries = (
	targetPackage: TargetPackageT,
	workspaceRootDirectory: string,
	packageJson: PackageJsonT
): DependencyEntryT[] => {
	const sectionsInManifest = Object.keys(packageJson).filter((key): key is DependencySectionT => {
		return DEPENDENCY_SECTIONS.includes(key as DependencySectionT)
	})

	return sectionsInManifest.flatMap(section => {
		const declarations = packageJson[section] ?? {}

		return Object.entries(declarations)
			.map(([name, declaredVersion]) => ({
				name,
				section,
				declaredVersion,
				installedVersion: readInstalledVersion(name, targetPackage.directory, workspaceRootDirectory)
			}))
	})
}

const normalizeRegistryUrl = (registryUrl: string): string => registryUrl.replace(/\/+$/, '')

const fetchLatestVersion = async (
	entry: DependencyEntryT,
	registryUrl: string,
	timeoutMilliseconds: number
): Promise<Pick<DependencyEntryT, 'latestVersion' | 'latestError'>> => {
	if (!isRegistryDependency(entry.declaredVersion)) return { latestError: 'not a registry version' }
	if (timeoutMilliseconds <= 0) return { latestError: 'registry timed out' }

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)

	try {
		const packagePath = encodeURIComponent(entry.name)
		const response = await fetch(`${normalizeRegistryUrl(registryUrl)}/${packagePath}/latest`, {
			headers: { accept: 'application/json', 'user-agent': 'abt' },
			signal: controller.signal
		})

		if (!response.ok) return { latestError: `registry returned ${response.status}` }

		const body = (await response.json()) as { version?: unknown }
		if (typeof body.version !== 'string') return { latestError: 'registry returned no version' }
		return { latestVersion: body.version }
	} catch (error) {
		const message = error instanceof Error && error.name === 'AbortError' ? 'registry timed out' : 'registry unavailable'
		return { latestError: message }
	} finally {
		clearTimeout(timeout)
	}
}

export const loadLatestVersions = async (
	entries: DependencyEntryT[],
	registryUrl = process.env.npm_config_registry ?? 'https://registry.npmjs.org'
): Promise<DependencyEntryT[]> => {
	const results: DependencyEntryT[] = new Array(entries.length)
	let nextIndex = 0
	const workerCount = Math.min(8, entries.length)
	const deadline = Date.now() + 5000

	const runWorker = async (): Promise<void> => {
		for (;;) {
			const entryIndex = nextIndex
			nextIndex += 1
			if (entryIndex >= entries.length) return

			const entry = entries[entryIndex]
			const latest = await fetchLatestVersion(entry, registryUrl, deadline - Date.now())
			results[entryIndex] = { ...entry, ...latest }
		}
	}

	await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
	return results
}
