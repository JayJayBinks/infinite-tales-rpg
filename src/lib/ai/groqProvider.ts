import { handleError } from '../util.svelte';
import JSONParser from '@streamparser/json/jsonparser.js';
import Groq from 'groq-sdk';
import {
	type ContentWithThoughts,
	LLM,
	type LLMconfig,
	type LLMMessage,
	type LLMRequest,
	LANGUAGE_PROMPT
} from '$lib/ai/llm';
import { sanitizeAnndParseJSON } from './agents/agentUtils';
import { GEMINI_MODELS } from './geminiProvider';

const roundRobinIndexByKey: Record<string, number | undefined> = {};

const pickRoundRobin = (key: string, models: string[]): string => {
	if (models.length === 0) return '';
	const current = roundRobinIndexByKey[key] ?? 0;
	const next = (current + 1) % models.length;
	roundRobinIndexByKey[key] = next;
	return models[current] ?? models[0]!;
};

/**
 * Groq provider using the official `groq-sdk`.
 *
 * Notes:
 * - This project expects JSON responses most of the time.
 * - `generateContentStream` attempts to parse streamed JSON and emit partial updates of the `story` field.
 */
export class GroqProvider extends LLM {
	private readonly groq: Groq;
	private readonly fallbackLLM?: LLM;

	constructor(llmConfig: LLMconfig, fallbackLLM?: LLM) {

		super(llmConfig);
		if (!llmConfig.apiKey) {
			// Keep the behavior consistent with other providers: surface a user-visible error.
			handleError('Please enter your Groq API Key first in the settings.');
		}
		this.groq = new Groq({ apiKey: this.llmConfig.apiKey || '', dangerouslyAllowBrowser: true });
		this.fallbackLLM = fallbackLLM;
	}

	getDefaultTemperature(): number {
		return 1.1;
	}

	getMaxTemperature(): number {
		return 2;
	}

	private buildSystemMessages(systemInstruction?: Array<string> | string) {
		const messages: Array<{ role: 'system'; content: string }> = [];
		if (!systemInstruction) return messages;
		if (typeof systemInstruction === 'string') {
			messages.push({ role: 'system', content: systemInstruction });
			return messages;
		}
		for (const instr of systemInstruction) {
			messages.push({ role: 'system', content: instr });
		}
		return messages;
	}

	private buildChatMessages(actionText: string, historyMessages: Array<LLMMessage>) {
		const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
		if (historyMessages) {
			for (const message of historyMessages) {
				messages.push({
					role: message.role === 'model' ? 'assistant' : 'user',
					content: message.content
				});
			}
		}
		if (actionText) {
			messages.push({ role: 'user', content: actionText });
		}
		return messages;
	}

	private stripCodeFences(text: string): string {
		return text
			.replaceAll('```json', '')
			.replaceAll('```html', '')
			.replaceAll('```', '')
			.trim();
	}

	private extractJsonCandidate(text: string): { leadingText: string; jsonCandidate: string } {
		const trimmed = text.trim();
		if (!trimmed) return { leadingText: '', jsonCandidate: '' };
		const objStart = trimmed.indexOf('{');
		const arrStart = trimmed.indexOf('[');
		let startIndex = -1;
		if (objStart === -1 && arrStart === -1) {
			return { leadingText: '', jsonCandidate: trimmed };
		}
		startIndex = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
		const leadingText = trimmed.slice(0, startIndex).trim();
		let jsonCandidate = trimmed.slice(startIndex);
		const lastEndIdx = Math.max(jsonCandidate.lastIndexOf('}'), jsonCandidate.lastIndexOf(']'));
		if (lastEndIdx !== -1 && lastEndIdx < jsonCandidate.length - 1) {
			jsonCandidate = jsonCandidate.slice(0, lastEndIdx + 1);
		}
		return { leadingText, jsonCandidate: jsonCandidate.trim() };
	}

	private async parseTextResponse(
		rawText: string,
		autoFixJSON: boolean,
		reportErrorToUser?: boolean
	): Promise<ContentWithThoughts | undefined> {
		const cleaned = this.stripCodeFences(rawText);
		if (!cleaned) {
			if (reportErrorToUser !== false) {
				handleError('Groq did not send a response...');
			}
			return undefined;
		}

		try {
			return { thoughts: '', content: JSON.parse(cleaned) };
		} catch (firstError) {
			try {
				const { leadingText, jsonCandidate } = this.extractJsonCandidate(cleaned);
				if (jsonCandidate) {
					try {
						return { thoughts: leadingText, content: JSON.parse(jsonCandidate) };
					} catch {
						// fall through
					}
				}

				const sanitized = sanitizeAnndParseJSON(cleaned);
				return {
					thoughts: leadingText,
					content: sanitized
				};
			} catch (secondError) {
				if (autoFixJSON) {
					try {
						// Delegate fixing to the configured fallback, if present.
						if (this.fallbackLLM) {
							const fixed = await this.fallbackLLM.generateContent({
								userMessage: 'Fix the JSON error: ' + (firstError as SyntaxError).message,
								historyMessages: [{ role: 'user', content: cleaned }],
								temperature: 0,
								tryAutoFixJSONError: false,
								reportErrorToUser
							});
							return fixed ? { thoughts: '', content: fixed.content } : undefined;
						}
					} catch (e) {
						if (reportErrorToUser !== false) {
							handleError(e as string);
						}
						return undefined;
					}
				}
				if (reportErrorToUser !== false) {
					handleError(secondError as string);
				}
				return undefined;
			}
		}
	}

	private async callFallback(request: LLMRequest, e: unknown): Promise<ContentWithThoughts | undefined> {
		if (!this.fallbackLLM) {
			if (request.reportErrorToUser !== false) {
				handleError(e as string);
			}
			return undefined;
		}
		request.model = this.fallbackLLM.llmConfig.model;
		const fallbackResult = await this.fallbackLLM.generateContent(request);
		if (!fallbackResult) {
			if (request.reportErrorToUser !== false) {
				handleError(e as string);
			}
			return undefined;
		}
		if (this.llmConfig.returnFallbackProperty || request.returnFallbackProperty) {
			fallbackResult.content['fallbackUsed'] = true;
		}
		return fallbackResult;
	}

	async generateContent(request: LLMRequest): Promise<ContentWithThoughts | undefined> {
		if (!this.llmConfig.apiKey) {
			return undefined;
		}

		let modelToUse = request.model || this.llmConfig.model || 'llama-3.1-8b-instant';
		modelToUse = this.resolveModelName(modelToUse, request);

		const contents = this.buildChatMessages(request.userMessage, request.historyMessages || []);
		const systemMessages = this.buildSystemMessages(
			request.systemInstruction || this.llmConfig.systemInstruction
		);

		const messages = [...systemMessages, ...contents];

		if (request.englishText) {
			messages.unshift({ role: 'system', content: 'Only respond in English ALWAYS!' });
		} else if (this.llmConfig.language) {
			messages.unshift({ role: 'system', content: LANGUAGE_PROMPT + this.llmConfig.language });
		}

		let temperature: number;
		if (request.temperature === 0 || this.llmConfig.temperature === 0) {
			temperature = 0;
		} else {
			temperature = Math.min(
				request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),
				this.getMaxTemperature()
			);
		}

		try {
			const response = await this.groq.chat.completions.create({
				model: modelToUse,
				messages,
				temperature,
				// Try to force JSON mode when possible (some models/gateways may ignore it).
				response_format: { type: 'json_object' }
			} as any);

			const text = response?.choices?.[0]?.message?.content ?? '';
			const autoFixJSON =
				((request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
					this.llmConfig.tryAutoFixJSONError) ||
				false;
			return await this.parseTextResponse(String(text), autoFixJSON, request.reportErrorToUser);
		} catch (e) {
			return await this.callFallback(request, e);
		}
	}

	async generateContentStream(
		request: LLMRequest,
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void,
		thoughtUpdateCallback?: (thoughtChunk: string, isComplete: boolean) => void
	): Promise<object | undefined> {
		// Groq doesn't expose "thoughts" in a separate channel.
		if (thoughtUpdateCallback) {
			thoughtUpdateCallback('', true);
		}
		if (!this.llmConfig.apiKey) {
			return undefined;
		}

		let modelToUse = request.model || this.llmConfig.model || 'llama-3.1-8b-instant';
		modelToUse = this.resolveModelName(modelToUse, request);

		const contents = this.buildChatMessages(request.userMessage, request.historyMessages || []);
		const systemMessages = this.buildSystemMessages(
			request.systemInstruction || this.llmConfig.systemInstruction
		);

		const messages = [...systemMessages, ...contents];
		if (request.englishText) {
			messages.unshift({ role: 'system', content: 'Only respond in English ALWAYS!' });
		} else if (this.llmConfig.language) {
			messages.unshift({ role: 'system', content: LANGUAGE_PROMPT + this.llmConfig.language });
		}

		let temperature: number;
		if (request.temperature === 0 || this.llmConfig.temperature === 0) {
			temperature = 0;
		} else {
			temperature = Math.min(
				request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),
				this.getMaxTemperature()
			);
		}

		const liveParser = new JSONParser({ emitPartialValues: true, emitPartialTokens: true });
		let jsonStarted = false;
		let markerFound = false;
		let pendingPrefixCheck = '';
		const MAX_MARKER_PREFIX_LEN = 8;
		let accumulatedRawText = '';
		let accumulatedJsonText = '';

		liveParser.onValue = ({ value, key, partial }) => {
			if (key === 'story' && typeof value === 'string') {
				storyUpdateCallback(value, !partial);
			}
		};
		liveParser.onError = (err) => {
			if (liveParser.isEnded || err.message?.includes('state ENDED')) {
				return;
			}
			throw err;
		};

		try {
			const stream = (await this.groq.chat.completions.create({
				model: modelToUse,
				messages,
				temperature,
				stream: true,
				response_format: { type: 'json_object' }
			} as any)) as unknown as AsyncIterable<any>;

			for await (const chunk of stream) {
				const chunkText = chunk?.choices?.[0]?.delta?.content;
				if (typeof chunkText !== 'string' || chunkText.length === 0) continue;
				accumulatedRawText += chunkText;

				if (!jsonStarted) {
					const effectiveSearchText = pendingPrefixCheck + chunkText;
					let jsonContentStartIndexInOriginal = -1;
					const markerWithNewline = '```json\n';
					const markerWithoutNewline = '```json';
					let markerIndex = effectiveSearchText.indexOf(markerWithNewline);
					let markerLength = markerIndex !== -1 ? markerWithNewline.length : 0;
					if (markerIndex === -1) {
						markerIndex = effectiveSearchText.indexOf(markerWithoutNewline);
						markerLength = markerIndex !== -1 ? markerWithoutNewline.length : 0;
					}

					if (markerIndex !== -1) {
						markerFound = true;
						jsonStarted = true;
						const jsonContentStartIndexInEffective = markerIndex + markerLength;
						jsonContentStartIndexInOriginal = Math.max(
							0,
							jsonContentStartIndexInEffective - pendingPrefixCheck.length
						);
						pendingPrefixCheck = '';
					} else {
						const braceIndex = effectiveSearchText.indexOf('{');
						if (braceIndex !== -1) {
							markerFound = false;
							jsonStarted = true;
							const jsonContentStartIndexInEffective = braceIndex;
							jsonContentStartIndexInOriginal = Math.max(
								0,
								jsonContentStartIndexInEffective - pendingPrefixCheck.length
							);
							pendingPrefixCheck = '';
						} else {
							pendingPrefixCheck = effectiveSearchText.substring(
								Math.max(0, effectiveSearchText.length - MAX_MARKER_PREFIX_LEN)
							);
							continue;
						}
					}

					if (jsonStarted && jsonContentStartIndexInOriginal !== -1) {
						const jsonPart = chunkText.substring(jsonContentStartIndexInOriginal);
						if (jsonPart.length > 0) {
							accumulatedJsonText += jsonPart;
							liveParser.write(jsonPart);
						}
					}
				} else {
					accumulatedJsonText += chunkText;
					liveParser.write(chunkText);
				}
			}

			liveParser.end();

			let cleanedJsonText = accumulatedJsonText;
			const endMarker = '```';
			if (markerFound) {
				const trimmedEnd = cleanedJsonText.trimEnd();
				if (trimmedEnd.endsWith(endMarker)) {
					cleanedJsonText = trimmedEnd
						.substring(0, trimmedEnd.length - endMarker.length)
						.trimEnd();
				}
			}
			cleanedJsonText = cleanedJsonText.replaceAll('```', '').trim();

			if (!cleanedJsonText) {
				storyUpdateCallback('', true);
				return undefined;
			}

			let finalJsonObject: any;
			try {
				finalJsonObject = sanitizeAnndParseJSON(cleanedJsonText);
			} catch (e) {
				// As a last resort, try parsing from the raw stream (may contain prefix text)
				finalJsonObject = sanitizeAnndParseJSON(accumulatedRawText);
			}

			const finalStory = typeof finalJsonObject?.story === 'string' ? finalJsonObject.story : '';
			storyUpdateCallback(finalStory, true);
			return finalJsonObject;
		} catch (e) {
			return (await this.callFallback(request, e))?.content;
		}
	}

	/**
	 * Resolve model names used by agents (e.g., GEMINI_MODELS.*) to concrete
	 * model ids supported by the Groq API.
	 */
	private resolveModelName(model: string, request?: LLMRequest): string {
		// Avoid Groq "compound" models due to low daily request limits.
		// Instead, distribute load across multiple concrete models (round-robin).
		const fastPool = [
			'llama-3.1-8b-instant',
			'meta-llama/llama-4-scout-17b-16e-instruct',
			'meta-llama/llama-4-maverick-17b-128e-instruct'
		];
		const qualityPool = [
			'meta-llama/llama-4-scout-17b-16e-instruct',
			'meta-llama/llama-4-maverick-17b-128e-instruct',
			'llama-3.3-70b-versatile'
		];

		// If caller explicitly set a concrete non-compound model, honor it.
		// But if they set groq/compound(_mini), we remap it into the pools.
		if (model === 'groq/compound' || model === 'groq/compound-mini') {
			const key = model === 'groq/compound' ? 'groq.compound.rr' : 'groq.compoundMini.rr';
			return pickRoundRobin(key, model === 'groq/compound' ? qualityPool : fastPool);
		}

		// Agent-provided Gemini enums: map to pools.
		if (model === GEMINI_MODELS.FLASH_2_5 || model === GEMINI_MODELS.FLASH_THINKING_2_0) {
			// Story progression / complex decisions.
			return pickRoundRobin('gemini.flash_thinking.rr', qualityPool);
		}
		if (model === GEMINI_MODELS.FLASH_LITE_2_5 || model === GEMINI_MODELS.FLASH_2_0) {
			// Small/fast tasks.
			return pickRoundRobin('gemini.flash_lite.rr', fastPool);
		}

		// Heuristic: streaming responses are usually the long story JSON -> prefer quality pool.
		if (request?.stream) {
			return pickRoundRobin('stream.rr', qualityPool);
		}

		// If the model already looks like a namespaced provider model, keep it.
		// (Note: this may fail at runtime if Groq doesn't support it.)
		if (model.includes('/')) return model;

		// Common aliases
		if (model.includes('70b')) return pickRoundRobin('alias.70b.rr', qualityPool);
		if (model.includes('instant') || model.includes('8b')) return pickRoundRobin('alias.fast.rr', fastPool);

		// Default: don't rewrite unknown strings.
		return model;
	}
}
