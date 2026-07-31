import path from 'node:path'
import fs from 'node:fs'
import type { DependencySectionT } from './types.js'

type StringRangeT = {
	start: number
	end: number
}

export type DependencyVersionUpdateT = {
	section: DependencySectionT
	packageName: string
	currentVersion: string
	nextVersion: string
}

const readJsonString = (source: string, start: number): { value: string; end: number } => {
	let cursor = start + 1

	while (cursor < source.length) {
		if (source[cursor] === '\\') {
			cursor += 2
			continue
		}

		if (source[cursor] === '"') {
			const end = cursor + 1
			return { value: JSON.parse(source.slice(start, end)) as string, end }
		}

		cursor += 1
	}

	throw new Error('package.json contains an unterminated string.')
}

const skipWhitespace = (source: string, start: number): number => {
	let cursor = start
	while (/\s/.test(source[cursor] ?? '')) cursor += 1
	return cursor
}

const skipJsonValue = (source: string, start: number): number => {
	const firstCharacter = source[start]
	if (firstCharacter === '"') return readJsonString(source, start).end

	if (firstCharacter === '{' || firstCharacter === '[') {
		const closingCharacter = firstCharacter === '{' ? '}' : ']'
		let cursor = start + 1

		while (cursor < source.length) {
			if (source[cursor] === '"') {
				cursor = readJsonString(source, cursor).end
				continue
			}

			if (source[cursor] === firstCharacter) {
				cursor = skipJsonValue(source, cursor)
				continue
			}

			if (source[cursor] === closingCharacter) return cursor + 1
			if (source[cursor] === '{' || source[cursor] === '[') {
				cursor = skipJsonValue(source, cursor)
				continue
			}

			cursor += 1
		}

		throw new Error('package.json contains an unterminated object or array.')
	}

	let cursor = start
	while (cursor < source.length && ![',', '}', ']'].includes(source[cursor])) cursor += 1
	return cursor
}

const findPropertyValue = (source: string, objectStart: number, propertyName: string): StringRangeT | undefined => {
	let cursor = skipWhitespace(source, objectStart + 1)

	while (cursor < source.length && source[cursor] !== '}') {
		if (source[cursor] !== '"') throw new Error('package.json contains an invalid object key.')
		const key = readJsonString(source, cursor)
		cursor = skipWhitespace(source, key.end)
		if (source[cursor] !== ':') throw new Error('package.json contains an invalid property.')

		const valueStart = skipWhitespace(source, cursor + 1)
		const valueEnd = skipJsonValue(source, valueStart)
		if (key.value === propertyName) return { start: valueStart, end: valueEnd }

		cursor = skipWhitespace(source, valueEnd)
		if (source[cursor] === ',') cursor = skipWhitespace(source, cursor + 1)
	}

	return undefined
}

const findDependencyVersionRange = (
	source: string,
	section: DependencySectionT,
	packageName: string
): StringRangeT | undefined => {
	const rootStart = skipWhitespace(source, 0)
	if (source[rootStart] !== '{') throw new Error('package.json must contain a JSON object.')

	const sectionRange = findPropertyValue(source, rootStart, section)
	if (sectionRange === undefined || source[sectionRange.start] !== '{') return undefined
	return findPropertyValue(source, sectionRange.start, packageName)
}

export const updateDependencyVersion = (
	packageDirectory: string,
	section: DependencySectionT,
	packageName: string,
	currentVersion: string,
	nextVersion: string
): void => {
	updateDependencyVersions(packageDirectory, [{ section, packageName, currentVersion, nextVersion }])
}

export const updateDependencyVersions = (
	packageDirectory: string,
	updates: DependencyVersionUpdateT[]
): void => {
	const packageJsonPath = path.join(packageDirectory, 'package.json')
	const source = fs.readFileSync(packageJsonPath, 'utf-8')
	const rangedUpdates = updates.map(update => {
		const versionRange = findDependencyVersionRange(source, update.section, update.packageName)
		if (versionRange === undefined) {
			throw new Error(`${update.packageName} is no longer listed in ${update.section}.`)
		}

		const actualVersion = JSON.parse(source.slice(versionRange.start, versionRange.end)) as unknown
		if (actualVersion !== update.currentVersion) {
			throw new Error(`${update.packageName} changed on disk; run abt deps again before editing it.`)
		}

		return { ...update, ...versionRange }
	})

	const descendingUpdates = rangedUpdates.sort((left, right) => right.start - left.start)
	let updatedSource = source

	for (const update of descendingUpdates) {
		updatedSource = `${updatedSource.slice(0, update.start)}${JSON.stringify(update.nextVersion)}${updatedSource.slice(update.end)}`
	}

	fs.writeFileSync(packageJsonPath, updatedSource, 'utf-8')
}
