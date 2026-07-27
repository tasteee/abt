import type { TargetPackageT } from './types.js'

export const stripScope = (packageName: string): string => {
	const isScoped = packageName.startsWith('@')
	if (!isScoped) return packageName

	const slashIndex = packageName.indexOf('/')
	const hasNoSlash = slashIndex === -1
	if (hasNoSlash) return packageName

	return packageName.slice(slashIndex + 1)
}

// The one name a package is known by in the menu, in `abt <package>
// <script>`, and in error messages — so what you read is always
// what you would type.
export const buildShortName = (targetPackage: TargetPackageT): string => {
	if (targetPackage.isRoot) return 'root'
	return stripScope(targetPackage.name)
}

// Sorting on the displayed name rather than the declared one, so
// `@example/utils` files under "u" where a reader expects it.
export const compareByShortName = (left: TargetPackageT, right: TargetPackageT): number => {
	return buildShortName(left).localeCompare(buildShortName(right))
}
