const MAXIMUM_SUGGESTION_DISTANCE = 3

// Standard Levenshtein over two rolling rows, kept small and
// self-contained so a typo suggestion costs nothing to ship.
const measureEditDistance = (left: string, right: string): number => {
	const leftCharacters = [...left]
	const rightCharacters = [...right]

	let previousRow = rightCharacters.map((_, rightIndex) => rightIndex + 1)
	previousRow = [0, ...previousRow]

	for (const [leftIndex, leftCharacter] of leftCharacters.entries()) {
		const currentRow = [leftIndex + 1]

		for (const [rightIndex, rightCharacter] of rightCharacters.entries()) {
			const doCharactersMatch = leftCharacter === rightCharacter
			const substitutionCost = doCharactersMatch ? 0 : 1

			const deletionScore = previousRow[rightIndex + 1] + 1
			const insertionScore = currentRow[rightIndex] + 1
			const substitutionScore = previousRow[rightIndex] + substitutionCost

			currentRow.push(Math.min(deletionScore, insertionScore, substitutionScore))
		}

		previousRow = currentRow
	}

	return previousRow[previousRow.length - 1]
}

// The nearest candidate, but only when it is near enough that
// suggesting it is helpful rather than noise.
export const findClosestName = (typedName: string, candidateNames: string[]): string | undefined => {
	const normalizedTyped = typedName.toLowerCase()

	const scoredCandidates = candidateNames.map(candidateName => {
		const distance = measureEditDistance(normalizedTyped, candidateName.toLowerCase())
		return { candidateName, distance }
	})

	const sortedCandidates = [...scoredCandidates].sort((left, right) => left.distance - right.distance)
	const bestCandidate = sortedCandidates[0]

	const hasNoCandidate = bestCandidate === undefined
	if (hasNoCandidate) return undefined

	const isCloseEnough = bestCandidate.distance <= MAXIMUM_SUGGESTION_DISTANCE
	if (!isCloseEnough) return undefined

	return bestCandidate.candidateName
}
