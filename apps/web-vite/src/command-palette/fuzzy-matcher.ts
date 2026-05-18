export interface FuzzyMatch {
	score: number;
	matchedIndices: number[];
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
	if (!query) return { score: 0, matchedIndices: [] };

	const lowerQuery = query.toLowerCase();
	const lowerTarget = target.toLowerCase();
	const matchedIndices: number[] = [];
	let queryIndex = 0;

	for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
		if (lowerTarget[i] === lowerQuery[queryIndex]) {
			matchedIndices.push(i);
			queryIndex++;
		}
	}

	if (queryIndex < lowerQuery.length) return null;

	let score = calculateScore(matchedIndices, lowerTarget.length);
	score += bonusForConsecutive(matchedIndices);
	score += bonusForStartOfWord(matchedIndices, lowerTarget);

	return { score, matchedIndices };
}

function calculateScore(matchedIndices: number[], targetLength: number): number {
	const matchRatio = matchedIndices.length / targetLength;
	const positionBonus = 1 - matchedIndices[0] / targetLength;
	return matchRatio * 0.5 + positionBonus * 0.5;
}

function bonusForConsecutive(matchedIndices: number[]): number {
	let consecutive = 0;
	for (let i = 1; i < matchedIndices.length; i++) {
		if (matchedIndices[i] === matchedIndices[i - 1] + 1) {
			consecutive++;
		}
	}
	return consecutive * 0.1;
}

function bonusForStartOfWord(matchedIndices: number[], target: string): number {
	let bonus = 0;
	for (const idx of matchedIndices) {
		if (idx === 0 || target[idx - 1] === " " || target[idx - 1] === "-" || target[idx - 1] === "_") {
			bonus += 0.15;
		}
	}
	return bonus;
}

export function fuzzySort(query: string, items: string[]): Array<{ item: string; score: number }> {
	const results: Array<{ item: string; score: number }> = [];
	for (const item of items) {
		const match = fuzzyMatch(query, item);
		if (match) {
			results.push({ item, score: match.score });
		}
	}
	return results.sort((a, b) => b.score - a.score);
}
