import JSONParser from '@streamparser/json/jsonparser.js';
import OpenAI from 'openai';
import { handleError } from '$lib/util.svelte';
import { JsonFixingInterceptorAgent } from '$lib/ai/agents/jsonFixingInterceptorAgent';
import {
	LANGUAGE_PROMPT,
	LLM,
	type ContentWithThoughts,
	type LLMMessage,
	type LLMRequest,
	type LLMconfig
} from '$lib/ai/llm';
import { sanitizeAnndParseJSON } from '$lib/ai/agents/agentUtils';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
	normalizeLocalStrictJsonInstruction,
	shouldUseJsonObjectResponseFormat
} from '$lib/ai/localJson';
import { applyLocalContextBudget, countMessageCharacters } from '$lib/ai/localContext';
import { writeLlmDebugState } from '$lib/ai/llmDebug';
import {
	buildValidationRepairInstruction,
	validateCriticalLLMResponse
} from '$lib/ai/llmValidation';

type ChatCreateResult<T> = {
	result: T;
	jsonModeAttempted: boolean;
	jsonModeRetriedWithout: boolean;
};

export async function createChatCompletionWithOptionalJsonMode<T>(
	create: (body: any) => Promise<T>,
	body: Record<string, any>,
	useJsonObjectMode: boolean
): Promise<ChatCreateResult<T>> {
	if (!useJsonObjectMode) {
		return {
			result: await create(body),
			jsonModeAttempted: false,
			jsonModeRetriedWithout: false
		};
	}
	try {
		return {
			result: await create({
				...body,
				response_format: { type: 'json_object' }
			}),
			jsonModeAttempted: true,
			jsonModeRetriedWithout: false
		};
	} catch {
		return {
			result: await create(body),
			jsonModeAttempted: true,
			jsonModeRetriedWithout: true
		};
	}
}

export class OpenAICompatibleProvider extends LLM {
	private readonly jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;
	private readonly client: OpenAI;

	constructor(llmConfig: LLMconfig) {
		super(llmConfig);
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);

		// Normalize base URL: strip any trailing /v1, /v1/chat/completions etc.
		const baseUrl = (llmConfig.baseUrl?.trim() || 'http://localhost:1234')
			.replace(/\/+$/, '')
			.replace(/\/v1\/chat\/completions$/, '')
			.replace(/\/v1$/, '');

		this.client = new OpenAI({
			apiKey: llmConfig.apiKey?.trim() || 'not-needed',
			baseURL: `${baseUrl}/v1`,
			dangerouslyAllowBrowser: true,
			// Strip x-stainless-* telemetry headers — they cause CORS preflight failures
			// on many self-hosted and third-party OpenAI-compatible endpoints.
			fetch: (url, init) => {
				if (init?.headers) {
					const headers = new Headers(init.headers as HeadersInit);
					for (const key of [...headers.keys()]) {
						if (key.startsWith('x-stainless')) headers.delete(key);
					}
					init = { ...init, headers };
				}
				return globalThis.fetch(url, init);
			}
		});
	}

	getDefaultTemperature(): number {
		return 0.7;
	}

	getMaxTemperature(): number {
		return 1.1;
	}

	private isGeminiModelName(model?: string): boolean {
		return typeof model === 'string' && model.trim().startsWith('gemini-');
	}

	private getModelToUse(request: LLMRequest): string {
		const requested = request.model?.trim();
		if (requested && !this.isGeminiModelName(requested)) return requested;
		const configured = this.llmConfig.model?.trim();
		if (configured) return configured;
		return 'local-model';
	}

	private buildMessages(request: LLMRequest): ChatCompletionMessageParam[] {
		const messages: ChatCompletionMessageParam[] = [];
		const strictJson = this.shouldUseStrictJson(request);

		const systemInstructions = request.systemInstruction ?? this.llmConfig.systemInstruction;
		if (typeof systemInstructions === 'string' && systemInstructions.trim()) {
			messages.push({
				role: 'system',
				content: strictJson
					? normalizeLocalStrictJsonInstruction(systemInstructions)
					: systemInstructions
			});
		} else if (Array.isArray(systemInstructions)) {
			for (const instr of systemInstructions) {
				if (instr?.trim()) {
					messages.push({
						role: 'system',
						content: strictJson ? normalizeLocalStrictJsonInstruction(instr) : instr
					});
				}
			}
		}

		if (!request.englishText && this.llmConfig.language?.trim()) {
			messages.push({
				role: 'system',
				content: LANGUAGE_PROMPT + this.llmConfig.language
			});
		}

		const history: Array<LLMMessage> = request.historyMessages ?? [];
		for (const message of history) {
			if (!message?.content) continue;
			messages.push({
				role: message.role === 'model' ? 'assistant' : 'user',
				content: message.content
			});
		}

		messages.push({ role: 'user', content: request.userMessage });
		return messages;
	}

	private shouldUseStrictJson(request: LLMRequest): boolean {
		return request.strictJson ?? this.llmConfig.strictJson ?? true;
	}

	private clampTemperature(request: LLMRequest): number {
		if (request.temperature === 0 || this.llmConfig.temperature === 0) return 0;
		return Math.min(
			request.temperature ?? this.llmConfig.temperature ?? this.getDefaultTemperature(),
			this.getMaxTemperature()
		);
	}

	private stripCodeFences(text: string): string {
		return text.replaceAll('```json', '').replaceAll('```html', '').replaceAll('```', '').trim();
	}

	private async parseJsonOrFix(
		responseText: string,
		autoFix: boolean,
		reportErrorToUser: boolean,
		request: LLMRequest
	): Promise<{ content?: object; sanitizingOrRepairUsed: boolean; validationErrors: string[] }> {
		const cleaned = this.stripCodeFences(responseText);
		let sanitizingOrRepairUsed = cleaned !== responseText;
		let parsed: object | undefined;
		try {
			parsed = sanitizeAnndParseJSON(cleaned);
		} catch (firstError) {
			if (autoFix) {
				try {
					sanitizingOrRepairUsed = true;
					parsed = (await this.jsonFixingInterceptorAgent.fixJSON(
						responseText,
						(firstError as SyntaxError).message,
						reportErrorToUser
					)) as object | undefined;
				} catch (secondError) {
					if (reportErrorToUser) handleError(secondError as unknown as string);
					return { sanitizingOrRepairUsed, validationErrors: [] };
				}
			} else {
				if (reportErrorToUser) handleError(firstError as unknown as string);
				return { sanitizingOrRepairUsed, validationErrors: [] };
			}
		}
		if (!parsed) return { sanitizingOrRepairUsed, validationErrors: [] };
		const validation = validateCriticalLLMResponse(parsed, request.validationContext);
		if (validation.valid) {
			return { content: parsed, sanitizingOrRepairUsed, validationErrors: [] };
		}
		if (!autoFix) {
			return { content: parsed, sanitizingOrRepairUsed, validationErrors: validation.errors };
		}
		sanitizingOrRepairUsed = true;
		const repaired = await this.jsonFixingInterceptorAgent.repairJSONByInstruction(
			JSON.stringify(parsed),
			buildValidationRepairInstruction(validation.errors),
			reportErrorToUser
		);
		const repairedValidation = validateCriticalLLMResponse(repaired, request.validationContext);
		return {
			content: repairedValidation.valid && repaired ? repaired : parsed,
			sanitizingOrRepairUsed,
			validationErrors: repairedValidation.valid ? [] : repairedValidation.errors
		};
	}

	async generateContent(request: LLMRequest): Promise<ContentWithThoughts | undefined> {
		const startedAt = Date.now();
		const prepared = applyLocalContextBudget(this.buildMessages(request));
		const messages = prepared.messages;
		const model = this.getModelToUse(request);
		const temperature = this.clampTemperature(request);
		const useJsonObjectMode =
			this.shouldUseStrictJson(request) && shouldUseJsonObjectResponseFormat(messages);

		let completion: OpenAI.Chat.Completions.ChatCompletion;
		let jsonModeAttempted = false;
		let jsonModeRetriedWithout = false;
		try {
			const result = await createChatCompletionWithOptionalJsonMode(
				(body) => this.client.chat.completions.create(body),
				{
					model,
					messages,
					temperature,
					stream: false
				},
				useJsonObjectMode
			);
			completion = result.result;
			jsonModeAttempted = result.jsonModeAttempted;
			jsonModeRetriedWithout = result.jsonModeRetriedWithout;
		} catch (e: any) {
			this.writeDebug(request, model, startedAt, prepared, {
				jsonModeAttempted,
				jsonModeRetriedWithout,
				lastError: e?.message ?? String(e)
			});
			if (request.reportErrorToUser !== false) {
				handleError(`OpenAI-compatible request failed: ${e?.message ?? e}`);
			}
			return undefined;
		}

		const responseText = completion.choices?.[0]?.message?.content;
		if (!responseText) {
			if (request.reportErrorToUser !== false)
				handleError('OpenAI-compatible LLM did not return any text.');
			return undefined;
		}

		const autoFixJson =
			((request.tryAutoFixJSONError ?? true) && (this.llmConfig.tryAutoFixJSONError ?? false)) ||
			false;
		const parsed = await this.parseJsonOrFix(
			responseText,
			autoFixJson,
			request.reportErrorToUser !== false,
			request
		);
		this.writeDebug(request, model, startedAt, prepared, {
			jsonModeAttempted,
			jsonModeRetriedWithout,
			sanitizingOrRepairUsed: parsed.sanitizingOrRepairUsed,
			validationErrors: parsed.validationErrors
		});
		if (!parsed.content) return undefined;
		return { thoughts: '', content: parsed.content };
	}

	async generateContentStream(
		request: LLMRequest,
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void
	): Promise<object | undefined> {
		const startedAt = Date.now();
		const prepared = applyLocalContextBudget(this.buildMessages(request));
		const messages = prepared.messages;
		const model = this.getModelToUse(request);
		const temperature = this.clampTemperature(request);
		const useJsonObjectMode =
			this.shouldUseStrictJson(request) && shouldUseJsonObjectResponseFormat(messages);

		let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
		let jsonModeAttempted = false;
		let jsonModeRetriedWithout = false;
		try {
			const result = await createChatCompletionWithOptionalJsonMode(
				(body) => this.client.chat.completions.create(body),
				{
					model,
					messages,
					temperature,
					stream: true
				},
				useJsonObjectMode
			);
			stream =
				result.result as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
			jsonModeAttempted = result.jsonModeAttempted;
			jsonModeRetriedWithout = result.jsonModeRetriedWithout;
		} catch (e: any) {
			this.writeDebug(request, model, startedAt, prepared, {
				jsonModeAttempted,
				jsonModeRetriedWithout,
				lastError: e?.message ?? String(e)
			});
			if (request.reportErrorToUser !== false) {
				handleError(`OpenAI-compatible stream failed: ${e?.message ?? e}`);
			}
			return undefined;
		}

		let accumulatedJsonText = '';
		let jsonStarted = false;
		let startedWith: '{' | '[' | null = null;
		let liveParserEnabled = true;
		let liveParserFailure: unknown | null = null;

		const liveParser = new JSONParser({ emitPartialValues: true, emitPartialTokens: true });
		liveParser.onValue = ({ value, key, partial }) => {
			if (key === 'story' && typeof value === 'string') {
				storyUpdateCallback(value, !partial);
			}
		};

		const writeJsonChunk = (chunk: string) => {
			if (!chunk) return;
			accumulatedJsonText += chunk;
			if (!liveParserEnabled) return;
			try {
				liveParser.write(chunk);
			} catch (e) {
				liveParserEnabled = false;
				liveParserFailure = e;
				console.warn('Disabling live JSON parsing due to stream parse error:', e);
			}
		};

		try {
			for await (const chunk of stream) {
				const deltaText = chunk.choices?.[0]?.delta?.content;
				if (typeof deltaText !== 'string' || deltaText.length === 0) continue;

				if (!jsonStarted) {
					const idxObj = deltaText.indexOf('{');
					const idxArr = deltaText.indexOf('[');
					if (idxObj === -1 && idxArr === -1) continue;
					let idx: number;
					if (idxObj === -1 || (idxArr !== -1 && idxArr < idxObj)) {
						idx = idxArr;
						startedWith = '[';
					} else {
						idx = idxObj;
						startedWith = '{';
					}
					jsonStarted = true;
					writeJsonChunk(deltaText.slice(idx));
				} else {
					writeJsonChunk(deltaText);
				}
			}
		} catch (e: any) {
			if (request.reportErrorToUser !== false) {
				handleError(`OpenAI-compatible stream error: ${e?.message ?? e}`);
			}
		}

		try {
			liveParser.end();
		} catch {
			// ignore
		}

		if (!accumulatedJsonText.trim()) {
			storyUpdateCallback('', true);
			return undefined;
		}

		const cleaned = this.stripCodeFences(accumulatedJsonText).replaceAll('```', '').trim();
		const autoFixJson =
			((request.tryAutoFixJSONError ?? true) && (this.llmConfig.tryAutoFixJSONError ?? false)) ||
			false;
		const finalObj = await this.parseJsonOrFix(
			cleaned,
			autoFixJson,
			request.reportErrorToUser !== false,
			request
		);
		this.writeDebug(request, model, startedAt, prepared, {
			jsonModeAttempted,
			jsonModeRetriedWithout,
			sanitizingOrRepairUsed: finalObj.sanitizingOrRepairUsed,
			validationErrors: finalObj.validationErrors
		});
		if (!finalObj.content) {
			if (request.reportErrorToUser !== false && liveParserFailure) {
				handleError(
					`Stream JSON was not incrementally parseable (startedWith=${startedWith ?? 'unknown'}). Final parse failed too: ${liveParserFailure}`
				);
			}
			return undefined;
		}
		const finalStory =
			typeof (finalObj.content as any)?.story === 'string' ? (finalObj.content as any).story : '';
		storyUpdateCallback(finalStory, true);
		return finalObj.content as object;
	}

	private writeDebug(
		request: LLMRequest,
		model: string,
		startedAt: number,
		prepared: ReturnType<typeof applyLocalContextBudget>,
		update: {
			jsonModeAttempted: boolean;
			jsonModeRetriedWithout: boolean;
			sanitizingOrRepairUsed?: boolean;
			validationErrors?: string[];
			lastError?: string;
		}
	) {
		writeLlmDebugState({
			provider: 'openai-compatible',
			baseUrl: this.llmConfig.baseUrl || 'http://localhost:1234',
			model,
			lastRequestStartedAt: new Date(startedAt).toISOString(),
			lastRequestDurationMs: Date.now() - startedAt,
			promptCharacters: prepared.originalCharacters || countMessageCharacters(prepared.messages),
			promptCharactersAfterBudget: prepared.finalCharacters,
			trimmedMessages: prepared.trimmedMessages,
			strictJson: this.shouldUseStrictJson(request),
			jsonModeAttempted: update.jsonModeAttempted,
			jsonModeRetriedWithout: update.jsonModeRetriedWithout,
			sanitizingOrRepairUsed: update.sanitizingOrRepairUsed || false,
			validationErrors: update.validationErrors || [],
			lastError: update.lastError
		});
	}
}
