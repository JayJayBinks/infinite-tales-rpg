export const jsonRule =
	'Most important Instruction! You must always respond with a single valid JSON in the following format, do not include any text before or after the JSON: ';

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
		const idx = [...trimmed].findIndex((c) => legalStarts.includes(c));
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
	try {
		return JSON.parse(working);
	} catch (e) {
		console.error('Failed to parse JSON after sanitization:', e);
		const extracted = extractFirstJsonObject(working);
		if (!extracted) throw e;
		return extracted;
	}
};

/**
 * Finds and parses the first valid, top-level JSON object from a string.
 * It correctly handles nested objects/arrays and ignores braces within strings.
 *
 * @param text A string that may contain a JSON object mixed with other text.
 * @returns A parsed JSON object of type T if found, otherwise null.
 */
function extractFirstJsonObject<T = Record<string, any>>(text: string): T | null {
	// Find the first opening curly brace or array bracket
	const objStart = text.indexOf('{');
	const arrStart = text.indexOf('[');
	let startIndex = -1;
	let isArray = false;
	if (objStart === -1 && arrStart === -1) {
		return null; // No object or array found
	}
	if (objStart === -1 || (arrStart !== -1 && arrStart < objStart)) {
		startIndex = arrStart;
		isArray = true;
	} else {
		startIndex = objStart;
	}

	// Scan for matching closing brace/bracket
	let level = 1;
	let inString = false;
	const openChar = isArray ? '[' : '{';
	const closeChar = isArray ? ']' : '}';

	for (let i = startIndex + 1; i < text.length; i++) {
		const char = text[i];
		// Toggle inString state if we encounter a quote that isn't escaped
		if (char === '"' && text[i - 1] !== '\\') {
			inString = !inString;
		}
		// If we are not inside a string, check for braces/brackets
		if (!inString) {
			if (char === openChar) {
				level++;
			} else if (char === closeChar) {
				level--;
			}
		}
		// If level is 0, we've found the end
		if (level === 0) {
			const endIndex = i + 1;
			const jsonString = text.substring(startIndex, endIndex);
			try {
				return JSON.parse(jsonString) as T;
			} catch {
				return null;
			}
		}
	}
	// If the loop finishes without finding a matching closing
	return null;
}
