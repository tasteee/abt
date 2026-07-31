import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TargetPackageT } from './types.js'

type HistoryDocumentT = {
	version: 1
	packages: Record<string, string[]>
}

const HISTORY_LIMIT = 20

export const getHistoryFilePath = (): string => {
	if (process.env.ABT_HISTORY_PATH !== undefined) return path.resolve(process.env.ABT_HISTORY_PATH)
	if (process.platform === 'win32') {
		const localApplicationData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
		return path.join(localApplicationData, 'abt', 'history.json')
	}
	if (process.platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support', 'abt', 'history.json')
	}
	const stateDirectory = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state')
	return path.join(stateDirectory, 'abt', 'history.json')
}

const packageHistoryKey = (targetPackage: TargetPackageT): string => {
	const packageJsonPath = path.resolve(targetPackage.directory, 'package.json')
	return process.platform === 'win32' ? packageJsonPath.toLowerCase() : packageJsonPath
}

const emptyHistory = (): HistoryDocumentT => ({ version: 1, packages: {} })

const readHistory = (historyPath: string): HistoryDocumentT => {
	try {
		const value = JSON.parse(fs.readFileSync(historyPath, 'utf8')) as unknown
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return emptyHistory()
		const document = value as { version?: unknown; packages?: unknown }
		if (document.version !== 1 || document.packages === null || typeof document.packages !== 'object') {
			return emptyHistory()
		}
		return document as HistoryDocumentT
	} catch {
		return emptyHistory()
	}
}

export const listRecentScripts = (
	targetPackage: TargetPackageT,
	historyPath = getHistoryFilePath()
): string[] => {
	const history = readHistory(historyPath)
	const remembered = history.packages[packageHistoryKey(targetPackage)] ?? []
	return remembered.filter(scriptName => targetPackage.scriptsByName[scriptName] !== undefined)
}

export const recordScriptChoice = (
	targetPackage: TargetPackageT,
	scriptName: string,
	historyPath = getHistoryFilePath()
): void => {
	if (targetPackage.scriptsByName[scriptName] === undefined) return
	try {
		const history = readHistory(historyPath)
		const key = packageHistoryKey(targetPackage)
		const existing = history.packages[key] ?? []
		history.packages[key] = [scriptName, ...existing.filter(candidate => candidate !== scriptName)].slice(0, HISTORY_LIMIT)
		fs.mkdirSync(path.dirname(historyPath), { recursive: true })
		const temporaryPath = `${historyPath}.${process.pid}.tmp`
		fs.writeFileSync(temporaryPath, `${JSON.stringify(history, undefined, 2)}\n`, 'utf8')
		fs.renameSync(temporaryPath, historyPath)
	} catch {
		// History is a convenience. Read-only homes and transient file
		// contention must never prevent a script from running.
	}
}
