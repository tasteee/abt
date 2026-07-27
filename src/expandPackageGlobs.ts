import path from 'node:path'
import fs from 'node:fs'

const IGNORED_DIRECTORY_NAMES = ['node_modules', '.git', 'bower_components', 'dist', 'build', 'coverage']

const MAXIMUM_DEEP_WILDCARD_DEPTH = 6

const checkIsSearchableDirectory = (directoryName: string): boolean => {
	const isHidden = directoryName.startsWith('.')
	if (isHidden) return false

	return !IGNORED_DIRECTORY_NAMES.includes(directoryName)
}

const listChildDirectoryNames = (directory: string): string[] => {
	try {
		const entries = fs.readdirSync(directory, { withFileTypes: true })
		const directoryEntries = entries.filter(entry => entry.isDirectory())
		const directoryNames = directoryEntries.map(entry => entry.name)
		return directoryNames.filter(checkIsSearchableDirectory)
	} catch {
		return []
	}
}

// Turn one path segment into a matcher. Only `*` and `?` are
// meaningful inside a segment; everything else is literal.
const buildSegmentMatcher = (segment: string): ((name: string) => boolean) => {
	const escapedSegment = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&')
	const pattern = escapedSegment.split('*').join('[^/]*').split('?').join('.')
	const segmentExpression = new RegExp(`^${pattern}$`)

	return (name: string) => segmentExpression.test(name)
}

// Walk only the directories the pattern actually reaches, rather
// than scanning the tree and filtering afterwards.
const collectMatchingDirectories = (baseDirectory: string, segments: string[], remainingDepth: number): string[] => {
	const hasConsumedEverySegment = segments.length === 0
	if (hasConsumedEverySegment) return [baseDirectory]

	const currentSegment = segments[0]
	const remainingSegments = segments.slice(1)

	const isDeepWildcard = currentSegment === '**'
	if (isDeepWildcard) return collectAcrossDepths(baseDirectory, remainingSegments, remainingDepth)

	const isLiteralSegment = !currentSegment.includes('*') && !currentSegment.includes('?')

	if (isLiteralSegment) {
		const childDirectory = path.join(baseDirectory, currentSegment)
		const doesChildExist = fs.existsSync(childDirectory)
		if (!doesChildExist) return []

		return collectMatchingDirectories(childDirectory, remainingSegments, remainingDepth)
	}

	const checkDoesNameMatch = buildSegmentMatcher(currentSegment)
	const childNames = listChildDirectoryNames(baseDirectory)
	const matchingNames = childNames.filter(checkDoesNameMatch)

	return matchingNames.flatMap(matchingName => {
		const childDirectory = path.join(baseDirectory, matchingName)
		return collectMatchingDirectories(childDirectory, remainingSegments, remainingDepth)
	})
}

// `**` matches the current directory and every searchable
// descendant, bounded so a deep repo cannot stall the menu.
const collectAcrossDepths = (baseDirectory: string, remainingSegments: string[], remainingDepth: number): string[] => {
	const matchesHere = collectMatchingDirectories(baseDirectory, remainingSegments, remainingDepth)

	const hasExhaustedDepth = remainingDepth <= 0
	if (hasExhaustedDepth) return matchesHere

	const childNames = listChildDirectoryNames(baseDirectory)

	const matchesBelow = childNames.flatMap(childName => {
		const childDirectory = path.join(baseDirectory, childName)
		return collectAcrossDepths(childDirectory, remainingSegments, remainingDepth - 1)
	})

	return [...matchesHere, ...matchesBelow]
}

const splitPatternIntoSegments = (pattern: string): string[] => {
	const normalizedPattern = pattern.split('\\').join('/')
	const rawSegments = normalizedPattern.split('/')

	return rawSegments.filter(segment => {
		const isEmpty = segment.length === 0
		const isCurrentDirectory = segment === '.'
		return !isEmpty && !isCurrentDirectory
	})
}

const expandOnePattern = (rootDirectory: string, pattern: string): string[] => {
	const segments = splitPatternIntoSegments(pattern)
	return collectMatchingDirectories(rootDirectory, segments, MAXIMUM_DEEP_WILDCARD_DEPTH)
}

// Resolve a set of workspace patterns into concrete directories
// that actually contain a package.json. Patterns beginning with
// `!` remove directories the earlier patterns matched.
export const expandPackageGlobs = (rootDirectory: string, patterns: string[]): string[] => {
	const includePatterns = patterns.filter(pattern => !pattern.startsWith('!'))
	const excludePatterns = patterns.filter(pattern => pattern.startsWith('!'))

	const includedDirectories = includePatterns.flatMap(pattern => {
		return expandOnePattern(rootDirectory, pattern)
	})

	const excludedDirectories = excludePatterns.flatMap(pattern => {
		const patternWithoutNegation = pattern.slice(1)
		return expandOnePattern(rootDirectory, patternWithoutNegation)
	})

	const excludedDirectorySet = new Set(excludedDirectories)
	const uniqueDirectories = [...new Set(includedDirectories)]

	return uniqueDirectories.filter(directory => {
		const wasExcluded = excludedDirectorySet.has(directory)
		if (wasExcluded) return false

		const isRootItself = directory === rootDirectory
		if (isRootItself) return false

		return fs.existsSync(path.join(directory, 'package.json'))
	})
}
