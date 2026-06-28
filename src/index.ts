#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import inquirer from 'inquirer'
import findPkg from 'find-pkg'
import { execa } from 'execa'

// Read abt's own version, resolved relative to this file — not the
// project package.json that abt happens to be run inside.
const selfDir = path.dirname(fileURLToPath(import.meta.url))
const selfPkgPath = path.join(selfDir, '..', 'package.json')
const selfPkg = JSON.parse(fs.readFileSync(selfPkgPath, 'utf-8'))

const cliArgs = process.argv.slice(2)

const wantsVersion = cliArgs.includes('--version') || cliArgs.includes('-v')
if (wantsVersion) {
	console.log(selfPkg.version)
	process.exit(0)
}

const wantsHelp = cliArgs.includes('--help') || cliArgs.includes('-h')
if (wantsHelp) {
	const helpText = `abt ${selfPkg.version} — list, pick, and run a package.json script.

Usage
  abt            choose a script to run
  abt --version  print the abt version
  abt --help     show this help`
	console.log(helpText)
	process.exit(0)
}

const pkgPath = await findPkg(process.cwd())

if (!pkgPath) {
	console.error('abt: no package.json found in this directory or any parent.')
	process.exit(1)
}

const pkgString = fs.readFileSync(pkgPath, 'utf-8')
const pkg = JSON.parse(pkgString)

// abt — list the scripts in the nearest package.json, pick one,
// and run it, handing the terminal fully to the script so that
// it behaves as if abt was never here.

type ScriptsByNameT = Record<string, string>

type ScriptChoiceT = {
	name: string
	value: string
}

const PackageManager = {
	npm: 'npm',
	pnpm: 'pnpm',
	yarn: 'yarn',
	bun: 'bun'
} as const

type PackageManagerT = typeof PackageManager[keyof typeof PackageManager]

const dim = (text: string): string => {
	return `[2m${text}[22m`
}

// Choose the package manager the project actually uses so the
// selected script runs the way the author intended.
const detectPackageManager = (projectDir: string): PackageManagerT => {
	const hasPnpmLock = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))
	if (hasPnpmLock) return PackageManager.pnpm

	const hasYarnLock = fs.existsSync(path.join(projectDir, 'yarn.lock'))
	if (hasYarnLock) return PackageManager.yarn

	const hasBunLock = fs.existsSync(path.join(projectDir, 'bun.lockb'))
	if (hasBunLock) return PackageManager.bun

	return PackageManager.npm
}

// Align the command after each name into a tidy second column.
const buildScriptChoices = (scriptsByName: ScriptsByNameT): ScriptChoiceT[] => {
	const scriptNames = Object.keys(scriptsByName)
	const nameLengths = scriptNames.map(scriptName => scriptName.length)
	const longestNameLength = Math.max(...nameLengths)
	const columnWidth = longestNameLength + 4

	return scriptNames.map(scriptName => {
		const command = scriptsByName[scriptName]
		const padding = ' '.repeat(columnWidth - scriptName.length)
		const label = `${scriptName}${padding}${dim(command)}`
		return { name: label, value: scriptName }
	})
}

const promptForScript = async (choices: ScriptChoiceT[]): Promise<string> => {
	const answer = await inquirer.prompt([
		{
			type: 'list',
			name: 'scriptName',
			message: '[ abt ∆ choose a script ]',
			choices,
			pageSize: 12,
			loop: false
		}
	])

	return answer.scriptName
}

// Run the script with inherited stdio so the child process owns
// the terminal completely — prompts and colored output all work.
const runScript = async (scriptName: string): Promise<void> => {
	const projectDir = path.dirname(pkgPath)
	const packageManager = detectPackageManager(projectDir)

	console.log(dim(`\n› ${packageManager} run ${scriptName}\n`))

	const result = await execa(packageManager, ['run', scriptName], {
		cwd: projectDir,
		stdio: 'inherit',
		reject: false
	})

	const exitCode = result.exitCode ?? 0
	process.exit(exitCode)
}

const main = async (): Promise<void> => {
	const scriptsByName: ScriptsByNameT = pkg.scripts ?? {}
	const scriptNames = Object.keys(scriptsByName)

	const hasNoScripts = scriptNames.length === 0
	if (hasNoScripts) {
		console.log('abt: no scripts found in package.json.')
		process.exit(0)
	}

	const choices = buildScriptChoices(scriptsByName)
	const selectedScript = await promptForScript(choices)
	await runScript(selectedScript)
}

// Ctrl+C out of the prompt should exit quietly, not crash.
const handleError = (error: unknown): void => {
	const wasCancelled = error instanceof Error && error.name === 'ExitPromptError'
	if (wasCancelled) {
		console.log('')
		process.exit(0)
	}

	const message = error instanceof Error ? error.message : String(error)
	console.error(`abt: ${message}`)
	process.exit(1)
}

try {
	await main()
} catch (error) {
	handleError(error)
}
