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
	type LLMResponseJsonSchema,
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
	jsonSchemaAttempted: boolean;
	jsonSchemaRetriedWithout: boolean;
	responseFormatCapabilityCacheHit: boolean;
	responseFormatCapabilities: ResponseFormatCapabilities;
};

export type ResponseFormatCapability = 'unknown' | 'supported' | 'unsupported';

export type ResponseFormatCapabilities = {
	jsonSchema: ResponseFormatCapability;
	jsonObject: ResponseFormatCapability;
};

const responseFormatCapabilityCache = new Map<string, ResponseFormatCapabilities>();

function createUnknownResponseFormatCapabilities(): ResponseFormatCapabilities {
	return { jsonSchema: 'unknown', jsonObject: 'unknown' };
}

function isUnsupportedResponseFormatError(error: unknown): boolean {
	const record = error as { status?: unknown; message?: unknown; error?: { message?: unknown } };
	const status = Number(record?.status);
	const message = String(record?.message || record?.error?.message || error || '').toLowerCase();
	const mentionsResponseFormat =
		message.includes('response_format') ||
		message.includes('json_schema') ||
		message.includes('json schema') ||
		message.includes('json_object') ||
		message.includes('structured output') ||
		message.includes('unsupported schema');
	const indicatesUnsupported =
		message.includes('unsupported') ||
		message.includes('not support') ||
		message.includes('unknown') ||
		message.includes('invalid') ||
		message.includes('not allowed');
	return mentionsResponseFormat && (indicatesUnsupported || [400, 404, 415, 422].includes(status));
}

export async function createChatCompletionWithOptionalJsonMode<T>(
	create: (body: any) => Promise<T>,
	body: Record<string, any>,
	useJsonObjectMode: boolean,
	responseJsonSchema?: LLMResponseJsonSchema,
	capabilities: ResponseFormatCapabilities = createUnknownResponseFormatCapabilities()
): Promise<ChatCreateResult<T>> {
	if (!useJsonObjectMode) {
		return {
			result: await create(body),
			jsonModeAttempted: false,
			jsonModeRetriedWithout: false,
			jsonSchemaAttempted: false,
			jsonSchemaRetriedWithout: false,
			responseFormatCapabilityCacheHit: false,
			responseFormatCapabilities: capabilities
		};
	}
	if (responseJsonSchema) {
		let jsonSchemaAttempted = false;
		let capabilityCacheHit = capabilities.jsonSchema === 'unsupported';
		if (capabilities.jsonSchema !== 'unsupported') {
			jsonSchemaAttempted = true;
			try {
				const result = await create({
					...body,
					response_format: {
						type: 'json_schema',
						json_schema: {
							name: responseJsonSchema.name,
							strict: responseJsonSchema.strict ?? true,
							schema: responseJsonSchema.schema
						}
					}
				});
				capabilities.jsonSchema = 'supported';
				return {
					result,
					jsonModeAttempted: true,
					jsonModeRetriedWithout: false,
					jsonSchemaAttempted: true,
					jsonSchemaRetriedWithout: false,
					responseFormatCapabilityCacheHit: capabilityCacheHit,
					responseFormatCapabilities: capabilities
				};
			} catch (error) {
				if (isUnsupportedResponseFormatError(error)) {
					capabilities.jsonSchema = 'unsupported';
				}
			}
		}
		if (capabilities.jsonObject === 'unsupported') {
			capabilityCacheHit = true;
			return {
				result: await create(body),
				jsonModeAttempted: false,
				jsonModeRetriedWithout: false,
				jsonSchemaAttempted,
				jsonSchemaRetriedWithout: jsonSchemaAttempted,
				responseFormatCapabilityCacheHit: capabilityCacheHit,
				responseFormatCapabilities: capabilities
			};
		}
		try {
			const result = await create({
				...body,
				response_format: { type: 'json_object' }
			});
			capabilities.jsonObject = 'supported';
			return {
				result,
				jsonModeAttempted: true,
				jsonModeRetriedWithout: false,
				jsonSchemaAttempted,
				jsonSchemaRetriedWithout: jsonSchemaAttempted,
				responseFormatCapabilityCacheHit: capabilityCacheHit,
				responseFormatCapabilities: capabilities
			};
		} catch (error) {
			if (isUnsupportedResponseFormatError(error)) {
				capabilities.jsonObject = 'unsupported';
			}
			return {
				result: await create(body),
				jsonModeAttempted: true,
				jsonModeRetriedWithout: true,
				jsonSchemaAttempted,
				jsonSchemaRetriedWithout: jsonSchemaAttempted,
				responseFormatCapabilityCacheHit: capabilityCacheHit,
				responseFormatCapabilities: capabilities
			};
		}
	}
	if (capabilities.jsonObject === 'unsupported') {
		return {
			result: await create(body),
			jsonModeAttempted: false,
			jsonModeRetriedWithout: false,
			jsonSchemaAttempted: false,
			jsonSchemaRetriedWithout: false,
			responseFormatCapabilityCacheHit: true,
			responseFormatCapabilities: capabilities
		};
	}
	try {
		const result = await create({
			...body,
			response_format: { type: 'json_object' }
		});
		capabilities.jsonObject = 'supported';
		return {
			result,
			jsonModeAttempted: true,
			jsonModeRetriedWithout: false,
			jsonSchemaAttempted: false,
			jsonSchemaRetriedWithout: false,
			responseFormatCapabilityCacheHit: false,
			responseFormatCapabilities: capabilities
		};
	} catch (error) {
		if (isUnsupportedResponseFormatError(error)) {
			capabilities.jsonObject = 'unsupported';
		}
		return {
			result: await create(body),
			jsonModeAttempted: true,
			jsonModeRetriedWithout: true,
			jsonSchemaAttempted: false,
			jsonSchemaRetriedWithout: false,
			responseFormatCapabilityCacheHit: false,
			responseFormatCapabilities: capabilities
		};
	}
}

export class OpenAICompatibleProvider extends LLM {
	private readonly jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;
	private readonly client: OpenAI;
	private readonly capabilityCacheBaseUrl: string;

	constructor(llmConfig: LLMconfig) {
		super(llmConfig);
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);

		// Normalize base URL: strip any trailing /v1, /v1/chat/completions etc.
		const baseUrl = (llmConfig.baseUrl?.trim() || 'http://localhost:1234')
			.replace(/\/+$/, '')
			.replace(/\/v1\/chat\/completions$/, '')
			.replace(/\/v1$/, '');
		this.capabilityCacheBaseUrl = baseUrl;

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

	private getResponseFormatCapabilities(model: string): ResponseFormatCapabilities {
		const cacheKey = `${this.capabilityCacheBaseUrl}|${model}`;
		let capabilities = responseFormatCapabilityCache.get(cacheKey);
		if (!capabilities) {
			capabilities = createUnknownResponseFormatCapabilities();
			responseFormatCapabilityCache.set(cacheKey, capabilities);
		}
		return capabilities;
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
	): Promise<{
		content?: object;
		sanitizingOrRepairUsed: boolean;
		validationErrors: string[];
		validationDetails: string[];
	}> {
		const cleaned = this.stripCodeFences(responseText);
		let sanitizingOrRepairUsed = cleaned !== responseText;
		const validationDetails: string[] = [];
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
					return { sanitizingOrRepairUsed, validationErrors: [], validationDetails };
				}
			} else {
				if (reportErrorToUser) handleError(firstError as unknown as string);
				return { sanitizingOrRepairUsed, validationErrors: [], validationDetails };
			}
		}
		if (!parsed) return { sanitizingOrRepairUsed, validationErrors: [], validationDetails };
		const validation = validateCriticalLLMResponse(parsed, request.validationContext);
		if (validation.valid) {
			validationDetails.push('Initial validation passed.');
			return { content: parsed, sanitizingOrRepairUsed, validationErrors: [], validationDetails };
		}
		validationDetails.push('Initial validation failed: ' + validation.errors.join(' | '));
		if (!autoFix) {
			validationDetails.push('Validation repair skipped because auto-fix is disabled.');
			return {
				content: parsed,
				sanitizingOrRepairUsed,
				validationErrors: validation.errors,
				validationDetails
			};
		}
		sanitizingOrRepairUsed = true;
		validationDetails.push('Validation repair call executed.');
		const repaired = await this.jsonFixingInterceptorAgent.repairJSONByInstruction(
			JSON.stringify(parsed),
			buildValidationRepairInstruction(validation.errors),
			reportErrorToUser
		);
		const repairedValidation = validateCriticalLLMResponse(repaired, request.validationContext);
		validationDetails.push(
			repairedValidation.valid
				? 'Validation repair passed.'
				: 'Validation repair failed: ' + repairedValidation.errors.join(' | ')
		);
		return {
			content: repairedValidation.valid && repaired ? repaired : parsed,
			sanitizingOrRepairUsed,
			validationErrors: repairedValidation.valid ? [] : repairedValidation.errors,
			validationDetails
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
		let jsonSchemaAttempted = false;
		let jsonSchemaRetriedWithout = false;
		let responseFormatCapabilityCacheHit = false;
		let responseFormatCapabilities = this.getResponseFormatCapabilities(model);
		try {
			const result = await createChatCompletionWithOptionalJsonMode(
				(body) => this.client.chat.completions.create(body),
				{
					model,
					messages,
					temperature,
					stream: false
				},
				useJsonObjectMode,
				request.responseJsonSchema,
				responseFormatCapabilities
			);
			completion = result.result;
			jsonModeAttempted = result.jsonModeAttempted;
			jsonModeRetriedWithout = result.jsonModeRetriedWithout;
			jsonSchemaAttempted = result.jsonSchemaAttempted;
			jsonSchemaRetriedWithout = result.jsonSchemaRetriedWithout;
			responseFormatCapabilityCacheHit = result.responseFormatCapabilityCacheHit;
			responseFormatCapabilities = result.responseFormatCapabilities;
		} catch (e: any) {
			this.writeDebug(request, model, startedAt, prepared, {
				jsonModeAttempted,
				jsonModeRetriedWithout,
				jsonSchemaAttempted,
				jsonSchemaRetriedWithout,
				responseFormatCapabilityCacheHit,
				responseFormatCapabilities,
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
			jsonSchemaAttempted,
			jsonSchemaRetriedWithout,
			responseFormatCapabilityCacheHit,
			responseFormatCapabilities,
			sanitizingOrRepairUsed: parsed.sanitizingOrRepairUsed,
			validationErrors: parsed.validationErrors,
			validationDetails: parsed.validationDetails
		});
		if (!parsed.content) return undefined;
		return { thoughts: '', content: parsed.content };
	}

	async generateTextStream(
		request: LLMRequest,
		textUpdateCallback: (textChunk: string, isComplete: boolean) => void
	): Promise<string> {
		const startedAt = Date.now();
		const requestWithoutJson: LLMRequest = { ...request, strictJson: false };
		const prepared = applyLocalContextBudget(this.buildMessages(requestWithoutJson));
		const messages = prepared.messages;
		const model = this.getModelToUse(requestWithoutJson);
		const temperature = this.clampTemperature(requestWithoutJson);

		let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
		try {
			stream = (await this.client.chat.completions.create({
				model,
				messages,
				temperature,
				stream: true
			})) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
		} catch (e: any) {
			this.writeDebug(requestWithoutJson, model, startedAt, prepared, {
				jsonModeAttempted: false,
				jsonModeRetriedWithout: false,
				lastError: e?.message ?? String(e)
			});
			if (request.reportErrorToUser !== false) {
				handleError(`OpenAI-compatible text stream failed: ${e?.message ?? e}`);
			}
			return '';
		}

		let accumulatedText = '';
		try {
			for await (const chunk of stream) {
				const deltaText = chunk.choices?.[0]?.delta?.content;
				if (typeof deltaText !== 'string' || deltaText.length === 0) continue;
				accumulatedText += deltaText;
				textUpdateCallback(accumulatedText, false);
			}
		} catch (e: any) {
			if (request.reportErrorToUser !== false) {
				handleError(`OpenAI-compatible text stream error: ${e?.message ?? e}`);
			}
		}

		textUpdateCallback(accumulatedText, true);
		this.writeDebug(requestWithoutJson, model, startedAt, prepared, {
			jsonModeAttempted: false,
			jsonModeRetriedWithout: false,
			sanitizingOrRepairUsed: false,
			validationDetails: ['Text narration stream completed without JSON parsing.']
		});
		return accumulatedText;
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
		let jsonSchemaAttempted = false;
		let jsonSchemaRetriedWithout = false;
		let responseFormatCapabilityCacheHit = false;
		let responseFormatCapabilities = this.getResponseFormatCapabilities(model);
		try {
			const result = await createChatCompletionWithOptionalJsonMode(
				(body) => this.client.chat.completions.create(body),
				{
					model,
					messages,
					temperature,
					stream: true
				},
				useJsonObjectMode,
				request.responseJsonSchema,
				responseFormatCapabilities
			);
			stream =
				result.result as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
			jsonModeAttempted = result.jsonModeAttempted;
			jsonModeRetriedWithout = result.jsonModeRetriedWithout;
			jsonSchemaAttempted = result.jsonSchemaAttempted;
			jsonSchemaRetriedWithout = result.jsonSchemaRetriedWithout;
			responseFormatCapabilityCacheHit = result.responseFormatCapabilityCacheHit;
			responseFormatCapabilities = result.responseFormatCapabilities;
		} catch (e: any) {
			this.writeDebug(request, model, startedAt, prepared, {
				jsonModeAttempted,
				jsonModeRetriedWithout,
				jsonSchemaAttempted,
				jsonSchemaRetriedWithout,
				responseFormatCapabilityCacheHit,
				responseFormatCapabilities,
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
			jsonSchemaAttempted,
			jsonSchemaRetriedWithout,
			responseFormatCapabilityCacheHit,
			responseFormatCapabilities,
			sanitizingOrRepairUsed: finalObj.sanitizingOrRepairUsed,
			validationErrors: finalObj.validationErrors,
			validationDetails: finalObj.validationDetails
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
			jsonSchemaAttempted?: boolean;
			jsonSchemaRetriedWithout?: boolean;
			responseFormatCapabilityCacheHit?: boolean;
			responseFormatCapabilities?: ResponseFormatCapabilities;
			sanitizingOrRepairUsed?: boolean;
			validationErrors?: string[];
			validationDetails?: string[];
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
			jsonSchemaAttempted: update.jsonSchemaAttempted || false,
			jsonSchemaRetriedWithout: update.jsonSchemaRetriedWithout || false,
			responseFormatCapabilityCacheHit: update.responseFormatCapabilityCacheHit || false,
			jsonSchemaCapability: update.responseFormatCapabilities?.jsonSchema,
			jsonObjectCapability: update.responseFormatCapabilities?.jsonObject,
			sanitizingOrRepairUsed: update.sanitizingOrRepairUsed || false,
			validationErrors: update.validationErrors || [],
			validationDetails: update.validationDetails || [],
			promptViewType: request.debugMetadata?.promptViewType,
			promptPreview: request.debugMetadata?.promptPreview,
			promptViewReductions: request.debugMetadata?.promptViewReductions || [],
			lastError: update.lastError
		});
	}
}
