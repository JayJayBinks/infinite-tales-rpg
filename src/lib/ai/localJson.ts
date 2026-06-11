import { jsonRule } from '$lib/ai/agents/agentUtils';

export const strictLocalJsonRule =
	'Most important instruction! Return exactly one valid JSON value. Do not include markdown, code fences, XML tags, analysis text, or any text outside JSON.\n' +
	'JSON format: ';

const analysisJsonInstructionPatterns = [
	/Before producing JSON, first briefly analyze[\s\S]*?Then output a single,[\s\S]*?JSON with the keys/gi,
	/Before producing JSON, first briefly analyze[\s\S]*?Then respond with a single valid JSON\.[\s\S]*?Then the JSON in the following format:/gi
];

export function normalizeLocalStrictJsonInstruction(instruction: string): string {
	let normalized = instruction.replaceAll(jsonRule, strictLocalJsonRule);
	for (const pattern of analysisJsonInstructionPatterns) {
		normalized = normalized.replace(pattern, strictLocalJsonRule);
	}
	return normalized;
}

export function shouldUseJsonObjectResponseFormat(messages: { content?: unknown }[]): boolean {
	const combined = messages
		.map((message) => (typeof message.content === 'string' ? message.content : ''))
		.join('\n');
	const firstJsonShape = findFirstJsonShape(combined);
	return firstJsonShape !== '[';
}

function findFirstJsonShape(text: string): '{' | '[' | undefined {
	const firstObject = text.indexOf('{');
	const firstArray = text.indexOf('[');
	if (firstObject === -1 && firstArray === -1) return undefined;
	if (firstObject === -1) return '[';
	if (firstArray === -1) return '{';
	return firstArray < firstObject ? '[' : '{';
}
