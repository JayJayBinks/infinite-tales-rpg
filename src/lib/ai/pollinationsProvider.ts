import { handleError } from '../util.svelte';
import { JsonFixingInterceptorAgent } from './agents/jsonFixingInterceptorAgent';
import {
	type ContentWithThoughts,
	LLM,
	type LLMconfig,
	type LLMMessage,
	type LLMRequest,
	LANGUAGE_PROMPT
} from '$lib/ai/llm';
import isPlainObject from 'lodash.isplainobject';
import type { GenerateContentConfig } from '@google/genai';
import { sanitizeAnndParseJSON } from './agents/agentUtils';
import { GEMINI_MODELS } from './geminiProvider';

export const defaultGPT4JsonConfig: GenerateContentConfig = {
	temperature: 1.1,
	topP: 0.95,
	topK: 40,
	maxOutputTokens: 8192,
	responseMimeType: 'application/json'
};

export class PollinationsProvider extends LLM {
	jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;
	model: string;
	fallbackLLM?: LLM;
	constructor(llmConfig: LLMconfig, fallbackLLM?: LLM) {
		super(llmConfig);
		this.model = llmConfig.model || 'gemini';
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
		this.fallbackLLM = fallbackLLM;
	}

	private resolvePollinationsModel(model?: string): 'gemini' | 'gemini-fast' {
		// Map FLASH_2_5 to 'gemini', everything else to 'gemini-fast'
		if (model === 'gemini' || model === GEMINI_MODELS.FLASH_2_5) return 'gemini';
		return 'gemini';
	}

	getDefaultTemperature(): number {
		return 1.1;
	}

	getMaxTemperature(): number {
		return 2;
	}

	generateContentStream(
		request: LLMRequest,
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void
	): Promise<object | undefined> {
		throw new Error('Method not implemented.' + request + storyUpdateCallback);
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
		startIndex =
			objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
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
				handleError('Pollinations did not send a response...');
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
						// fall through to sanitization/fixing
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
						const fixedJson = await this.jsonFixingInterceptorAgent.fixJSON(
							cleaned,
							(firstError as SyntaxError).message,
							reportErrorToUser
						);
						return fixedJson ? { thoughts: '', content: fixedJson } : undefined;
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

	async generateContent(request: LLMRequest): Promise<ContentWithThoughts | undefined> {
		if (!this.llmConfig.apiKey) {
			if (request.reportErrorToUser !== false) {
				handleError('Please enter your Pollinations API token first in the settings.');
			}
			return undefined;
		}

		const contents = this.buildContentsFormat(request.userMessage, request.historyMessages || []);
		const systemInstructions = this.buildSystemInstruction(
			request.systemInstruction || this.llmConfig.systemInstruction
		);
		if (request.englishText) {
			systemInstructions.push({ role: 'system', content: 'Only respond in English ALWAYS!' });
		} else if (this.llmConfig.language) {
			const languageInstruction = LANGUAGE_PROMPT + this.llmConfig.language;
			systemInstructions.push({ role: 'system', content: languageInstruction });
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
		console.log('calling llm with temperature', temperature);
		const url = `https://gen.pollinations.ai/v1/chat/completions`;
		const modelToUse = this.resolvePollinationsModel(request.model || this.model);
		const body: any = {
			messages: [...systemInstructions, ...contents],
			model: modelToUse,
			modalities: ['text'],
			stream: false,
			temperature,
			// Request TEXT directly from Pollinations
			response_format: { type: 'json_object' }
		};
		let result;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.llmConfig.apiKey}`
				},
				body: JSON.stringify(body)
			});
			if (response.status === 500) {
				throw new Error(await response.text());
			}
			if (response.status === 401 || response.status === 403) {
				throw new Error('Pollinations authentication failed (check your token).');
			}
			result = response;
		} catch (e: any) {
			const fallbackMessage = `Fallback Pollinations Gemini Thinking failed... You can go to the settings and enable GPT-4o-mini as fallback.`;
			e.message = fallbackMessage + ' ' + (e as Error).message;
			if (this.fallbackLLM) {
				console.log('Pollinations Fallback LLM for error: ', this.model, e.message);
				request.model = this.fallbackLLM.llmConfig.model;
				const fallbackResult = await this.fallbackLLM.generateContent(request);
				if (!fallbackResult) {
					if (request.reportErrorToUser !== false) {
						handleError(e as unknown as string);
					}
				} else {
					if (this.llmConfig.returnFallbackProperty || request.returnFallbackProperty) {
						fallbackResult.content['fallbackUsed'] = true;
					}
				}
				return fallbackResult;
			} else {
				if (request.reportErrorToUser !== false) {
					handleError(e as unknown as string);
				}
				return undefined;
			}
		}
		try {
			const response: Response = result;
			const autoFixJSON =
				((request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
					this.llmConfig.tryAutoFixJSONError) ||
				false;
			return await this.parseContentByModel(modelToUse, response, autoFixJSON, request.reportErrorToUser);
		} catch (e) {
			if (request.reportErrorToUser !== false) {
				handleError(e as string);
			}
		}
		return undefined;
	}

	buildSystemInstruction(systemInstruction?: Array<string> | string) {
		const instructions: any[] = [];
		if (!systemInstruction) return instructions;
		if (typeof systemInstruction === 'string') {
			instructions.push({ role: 'system', content: systemInstruction });
		} else {
			systemInstruction.forEach((instr) => instructions.push({ role: 'system', content: instr }));
		}
		return instructions;
	}

	buildContentsFormat(actionText: string, historyMessages: Array<LLMMessage>) {
		const contents: any[] = [];
		if (historyMessages) {
			historyMessages.forEach((message) => {
				contents.push({
					role: message['role'] === 'model' ? 'assistant' : 'user',
					content: message['content']
				});
			});
		}
		if (actionText) {
			contents.push({
				role: 'user',
				content: actionText
			});
		}
		return contents;
	}

	parseDeepseek(response: any, autoFixJSON: boolean, reportErrorToUser?: boolean) {
		if (isPlainObject(response)) {
			return { thoughts: '', content: response as object };
		}
		return this.parseTextResponse(String(response), autoFixJSON, reportErrorToUser);
	}

	parseOpenAI(response: any, autoFixJSON: boolean, reportErrorToUser?: boolean) {
		if (!response.choices) {
			return { thoughts: '', content: response as object };
		}
		const responseText = response.choices[0].message.content;
		return this.parseTextResponse(String(responseText), autoFixJSON, reportErrorToUser);
	}

	parseGeminiThinking(response: string, autoFixJSON: boolean, reportErrorToUser?: boolean) {
		return this.parseTextResponse(response, autoFixJSON, reportErrorToUser);
	}

	async parseContentByModel(
		model: string,
		response: Response,
		autoFixJson: boolean,
		reportErrorToUser?: boolean
	): Promise<ContentWithThoughts | undefined> {
		// Try to parse a JSON object directly when Pollinations returns JSON
		try {
			const parsed = await response.json();
			// If OpenAI-style response, delegate to parseOpenAI
			if (parsed && parsed.choices) {
				return this.parseOpenAI(parsed, autoFixJson, reportErrorToUser);
			}
			// If it's a plain object, return it directly
			if (isPlainObject(parsed)) {
				return { thoughts: '', content: parsed as object };
			}
			// Fallback to text parsing
			return this.parseTextResponse(String(parsed), autoFixJson, reportErrorToUser);
		} catch (e) {
			// Fallback to plain text response handling
			return this.parseTextResponse(await response.text(), autoFixJson, reportErrorToUser);
		}
	}
}
