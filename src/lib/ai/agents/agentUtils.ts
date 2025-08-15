/**
 * Attempts to repair a malformed JSON string and parse it.
 * Accepts any legal JSON start character or empty string.
 * Returns parsed json or re throws
 */
export const sanitizeAnndParseJSON = (input: string): any => {
	// Trim whitespace
	const trimmed = input.trim();
	if (trimmed === '') return {};

			// Only consider '{' and '[' as legal JSON start characters
			const legalStarts = ['{', '['];
			const firstChar = trimmed[0];
			let working = trimmed;
				if (!legalStarts.includes(firstChar)) {
					// Try to find first legal start
					const idx = [...trimmed].findIndex(c => legalStarts.includes(c));
					if (idx !== -1) {
						const removedText = trimmed.slice(0, idx);
						if (removedText.length > 0) {
							console.warn(
								`repairJsonString: Removed leading text before first JSON start: "${removedText.substring(0, 30)}${removedText.length > 30 ? '...' : ''}"`
							);
						}
						working = trimmed.slice(idx);
					}
				}
				// Trim any trailing characters after the last legal end
				const lastEndIdx = Math.max(working.lastIndexOf('}'), working.lastIndexOf(']'));
				if (lastEndIdx !== -1 && lastEndIdx < working.length - 1) {
					const removedText = working.slice(lastEndIdx + 1);
					console.warn(
						`repairJsonString: Removed trailing text after last JSON end: "${removedText.substring(0, 30)}${removedText.length > 30 ? '...' : ''}"`
					);
					working = working.slice(0, lastEndIdx + 1);
				}
		return JSON.parse(working);
};
export const jsonRule = 'Most important Instruction! You must always respond with no other text than valid JSON in the following format: '