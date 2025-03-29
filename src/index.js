#!/usr/bin/env node

import shell from 'shelljs'
import fs from 'fs'
import path from 'path'
import inquirer from 'inquirer'

/**
 * Finds the closest package.json file by traversing up the directory tree.
 * @param {string} startPath - The starting directory.
 * @returns {string|null} - The path to the package.json file or null if not found.
 */
const findClosestPackageJson = startPath => {
	let currentDir = startPath

	while (currentDir !== path.parse(currentDir).root) {
		const pkgPath = path.join(currentDir, 'package.json')
		if (fs.existsSync(pkgPath)) {
			return pkgPath
		}
		currentDir = path.dirname(currentDir)
	}

	console.error('Error: No package.json found in the directory hierarchy.')
	process.exit(1)
}

/**
 * Reads and parses the scripts from a package.json file.
 * @param {string} pkgPath - The path to the package.json file.
 * @returns {Object} - An object containing the scripts.
 */
const getScriptsFromPackageJson = pkgPath => {
	try {
		const pkgContent = fs.readFileSync(pkgPath, 'utf-8')
		const pkgJson = JSON.parse(pkgContent)
		return pkgJson.scripts || {}
	} catch (error) {
		console.error('Error reading package.json:', error.message)
		process.exit(1)
	}
}

/**
 * Formats script names and commands for display in the selectable list.
 * @param {Object} scripts - The scripts object from package.json.
 * @returns {Array<Object>} - An array of formatted choices for Inquirer.
 */
const formatScriptsForPrompt = scripts => {
	const scriptNames = Object.keys(scripts)

	const longestScriptNameLength = scriptNames.reduce((final, scriptName) => {
		if (scriptName.length > final) return scriptName.length
		return final
	}, 0)

	const spacesCount = longestScriptNameLength + 10

	return Object.entries(scripts).map(([name, command]) => {
		const finalSpacesCount = spacesCount - name.length

		return {
			name: `${name}${spaces(finalSpacesCount)}${command}`, // Display both name and command
			value: name // Use script name as the value for selection
		}
	})
}

const spaces = count => {
	return Array(count)
		.fill(' ')
		.join('')
}

/**
 * Displays a list of scripts in the terminal and allows the user to select one to run.
 * @param {Object} scripts - The scripts object from package.json.
 */
const promptAndRunScript = async scripts => {
	const formattedScripts = formatScriptsForPrompt(scripts)

	if (formattedScripts.length === 0) {
		console.log('No scripts found in package.json.')
		return
	}

	try {
		const { selectedScript } = await inquirer.prompt([
			{
				type: 'list',
				name: 'selectedScript',
				message: '[ abt ∆ choose a script ]',
				choices: formattedScripts
			}
		])

		runScript(selectedScript)
	} catch (error) {
		if (error.name === 'ExitPromptError') {
			console.log('')
			process.exit(0) // Exit without error
		} else {
			console.error('An unexpected error occurred:', error.message)
			process.exit(1) // Exit with error
		}
	}
}

/**
 * Executes an npm script using shelljs.
 * @param {string} scriptName - The name of the script to execute.
 */
const runScript = scriptName => {
	console.log(`Running script: ${scriptName}`)

	const result = shell.exec(`npm run ${scriptName}`, { stdio: 'inherit' })

	if (result.code !== 0) {
		console.error(`Error: Script "${scriptName}" failed.`)
		process.exit(result.code)
	}
}

// Main execution flow
const main = () => {
	const currentDir = process.cwd()
	const pkgPath = findClosestPackageJson(currentDir)
	const scripts = getScriptsFromPackageJson(pkgPath)

	promptAndRunScript(scripts)
}

// Handle uncaught exceptions globally for graceful exits
process.on('uncaughtException', error => {
	if (error.name === 'ExitPromptError') {
		console.log('👋 Exiting gracefully. See you next time!')
		process.exit(0) // Exit without error
	} else {
		console.error('An unexpected error occurred:', error.message)
		process.exit(1) // Exit with error
	}
})

main()
