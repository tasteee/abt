export type FuzzyMatchT<T> = {
	item: T
	score: number
	originalIndex: number
}

const normalize = (value: string): string => value.normalize('NFKD').toLocaleLowerCase()

export const fuzzyScore = (candidateValue: string, queryValue: string): number | undefined => {
	const candidate = normalize(candidateValue)
	const query = normalize(queryValue.trim())
	if (query.length === 0) return 0
	if (candidate === query) return 100_000
	if (candidate.startsWith(query)) return 80_000 - (candidate.length - query.length)

	const containedAt = candidate.indexOf(query)
	if (containedAt !== -1) return 60_000 - containedAt * 100 - (candidate.length - query.length)

	let candidateIndex = 0
	let previousMatchIndex = -2
	let score = 20_000 - candidate.length

	for (const queryCharacter of query) {
		const matchIndex = candidate.indexOf(queryCharacter, candidateIndex)
		if (matchIndex === -1) return undefined

		const isAdjacent = matchIndex === previousMatchIndex + 1
		const isWordStart = matchIndex === 0 || /[\s._:/-]/.test(candidate[matchIndex - 1])
		const gap = previousMatchIndex < 0 ? matchIndex : matchIndex - previousMatchIndex - 1
		score += isAdjacent ? 50 : 0
		score += isWordStart ? 30 : 0
		score -= gap * 8
		previousMatchIndex = matchIndex
		candidateIndex = matchIndex + 1
	}

	return score
}

export const fuzzyFilter = <T>(items: T[], query: string, readSearchText: (item: T) => string): T[] => {
	if (query.trim().length === 0) return [...items]

	return items
		.flatMap((item, originalIndex): FuzzyMatchT<T>[] => {
			const score = fuzzyScore(readSearchText(item), query)
			return score === undefined ? [] : [{ item, score, originalIndex }]
		})
		.sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
		.map(match => match.item)
}
