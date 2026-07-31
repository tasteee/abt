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

type StableVersionT = {
	version: string
	major: number
	minor: number
	patch: number
}

const parseStableVersion = (version: string): StableVersionT | undefined => {
	const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/)
	if (match === null) return undefined

	return {
		version,
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10)
	}
}

const readMajorVersion = (version: string | undefined): number | undefined => {
	if (version === undefined) return undefined
	const match = version.match(/\d+\.\d+\.\d+/)
	return match === null ? undefined : Number.parseInt(match[0].split('.')[0], 10)
}

const compareStableVersions = (left: StableVersionT, right: StableVersionT): number => {
	return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

const findLatestMajorVersion = (entry: DependencyEntryT, versions: string[]): string | undefined => {
	const currentMajor = readMajorVersion(entry.installedVersion) ?? readMajorVersion(entry.declaredVersion)
	if (currentMajor === undefined) return undefined

	return versions
		.map(parseStableVersion)
		.filter((version): version is StableVersionT => version !== undefined && version.major === currentMajor)
		.sort(compareStableVersions)
		.at(-1)?.version
}

const fetchLatestVersion = async (
	entry: DependencyEntryT,
	registryUrl: string,
	timeoutMilliseconds: number
): Promise<Pick<DependencyEntryT, 'majorVersion' | 'majorError' | 'latestVersion' | 'latestError'>> => {
	if (!isRegistryDependency(entry.declaredVersion)) {
		return { majorError: 'not a registry version', latestError: 'not a registry version' }
	}
	if (timeoutMilliseconds <= 0) return { majorError: 'registry timed out', latestError: 'registry timed out' }

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)

	try {
		const packagePath = encodeURIComponent(entry.name)
		const response = await fetch(`${normalizeRegistryUrl(registryUrl)}/${packagePath}`, {
			headers: { accept: 'application/vnd.npm.install-v1+json', 'user-agent': 'abt' },
			signal: controller.signal
		})

		if (!response.ok) {
			const message = `registry returned ${response.status}`
			return { majorError: message, latestError: message }
		}

		const body = (await response.json()) as {
			version?: unknown
			'dist-tags'?: { latest?: unknown }
			versions?: Record<string, unknown>
		}
		const taggedLatest = body['dist-tags']?.latest
		const latestVersion = typeof taggedLatest === 'string' ? taggedLatest : typeof body.version === 'string' ? body.version : undefined
		const publishedVersions = Object.keys(body.versions ?? {})
		if (latestVersion !== undefined && !publishedVersions.includes(latestVersion)) publishedVersions.push(latestVersion)
		const majorVersion = findLatestMajorVersion(entry, publishedVersions)

		return {
			...(majorVersion === undefined ? { majorError: 'registry returned no matching major version' } : { majorVersion }),
			...(latestVersion === undefined ? { latestError: 'registry returned no latest version' } : { latestVersion })
		}
	} catch (error) {
		const message = error instanceof Error && error.name === 'AbortError' ? 'registry timed out' : 'registry unavailable'
		return { majorError: message, latestError: message }
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
