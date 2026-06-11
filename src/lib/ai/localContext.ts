import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type LocalContextBudgetResult = {
	messages: ChatCompletionMessageParam[];
	originalCharacters: number;
	finalCharacters: number;
	trimmedMessages: number;
};

const DEFAULT_MAX_HISTORY_MESSAGES = 8;
const DEFAULT_MAX_TOTAL_CHARACTERS = 36_000;
const DEFAULT_MAX_SINGLE_MESSAGE_CHARACTERS = 12_000;

export function applyLocalContextBudget(
	messages: ChatCompletionMessageParam[],
	maxHistoryMessages = DEFAULT_MAX_HISTORY_MESSAGES,
	maxTotalCharacters = DEFAULT_MAX_TOTAL_CHARACTERS
): LocalContextBudgetResult {
	const originalCharacters = countMessageCharacters(messages);
	const systemMessages = messages.filter((message) => message.role === 'system');
	const nonSystemMessages = messages.filter((message) => message.role !== 'system');
	const finalUserMessage = nonSystemMessages.at(-1);
	const historyMessages = finalUserMessage ? nonSystemMessages.slice(0, -1) : nonSystemMessages;
	const compactHistory = keepFirstAndLast(historyMessages, 2, Math.max(0, maxHistoryMessages - 2));

	let compacted = [
		...systemMessages,
		...compactHistory,
		...(finalUserMessage ? [finalUserMessage] : [])
	].map((message) => trimMessageContent(message, DEFAULT_MAX_SINGLE_MESSAGE_CHARACTERS));

	while (countMessageCharacters(compacted) > maxTotalCharacters && compacted.length > 1) {
		const removableIndex = compacted.findIndex((message, index) => {
			const isLast = index === compacted.length - 1;
			return message.role !== 'system' && !isLast;
		});
		if (removableIndex === -1) break;
		compacted = compacted.filter((_, index) => index !== removableIndex);
	}

	return {
		messages: compacted,
		originalCharacters,
		finalCharacters: countMessageCharacters(compacted),
		trimmedMessages: messages.length - compacted.length
	};
}

export function countMessageCharacters(messages: ChatCompletionMessageParam[]): number {
	return messages.reduce((sum, message) => sum + getContentText(message.content).length, 0);
}

function keepFirstAndLast<T>(items: T[], firstCount: number, lastCount: number): T[] {
	if (items.length <= firstCount + lastCount) return items;
	return [...items.slice(0, firstCount), ...items.slice(lastCount * -1)];
}

function trimMessageContent(
	message: ChatCompletionMessageParam,
	maxCharacters: number
): ChatCompletionMessageParam {
	const content = message.content;
	if (typeof content !== 'string' || content.length <= maxCharacters) return message;
	return {
		...message,
		content:
			content.slice(0, Math.floor(maxCharacters / 2)) +
			'\n[...local context budget trimmed middle content...]\n' +
			content.slice(Math.floor(maxCharacters / 2) * -1)
	} as ChatCompletionMessageParam;
}

function getContentText(content: ChatCompletionMessageParam['content']): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((part) => {
			if (typeof part === 'string') return part;
			if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
				return part.text;
			}
			return '';
		})
		.join('');
}
