import { handleError } from '../util.svelte';
import {
	type Content,
	type GenerateContentResult,
	type GenerationConfig,
	GoogleGenerativeAI,
	HarmBlockThreshold,
	HarmCategory,
	type Part,
	type SafetySetting
} from '@google/generative-ai';
import { JsonFixingInterceptorAgent } from './agents/jsonFixingInterceptorAgent';
import {
	LLM,
	type LLMconfig,
	type LLMMessage,
	type LLMRequest,
	type LLMReasoningResponse,
	LANGUAGE_PROMPT
} from '$lib/ai/llm';
import {
	errorState,
	getIsGeminiThinkingOverloaded,
	setIsGeminiFlashExpOverloaded,
	setIsGeminiThinkingOverloaded
} from '$lib/state/errorState.svelte';

const safetySettings: Array<SafetySetting> = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	}
];

export const defaultGeminiJsonConfig: GenerationConfig = {
	temperature: 1,
	topP: 0.95,
	topK: 40,
	maxOutputTokens: 8192,
	responseMimeType: 'text/plain'
};

export class GeminiProvider extends LLM {
	genAI: GoogleGenerativeAI;
	jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;
	fallbackLLM?: LLM;

	constructor(llmConfig: LLMconfig, fallbackLLM?: LLM) {
		super(llmConfig);
		if (!llmConfig.apiKey) {
			errorState.userMessage = 'Please enter your Google Gemini API Key first in the settings.';
		}
		this.genAI = new GoogleGenerativeAI(this.llmConfig.apiKey || '');
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
		this.fallbackLLM = fallbackLLM;
	}

	getDefaultTemperature(): number {
		return defaultGeminiJsonConfig.temperature as number;
	}

	getMaxTemperature(): number {
		return 2;
	}

	async generateReasoningContent(request: LLMRequest): Promise<LLMReasoningResponse | undefined> {
		if (!this.llmConfig.apiKey) {
			errorState.userMessage = 'Please enter your Google Gemini API Key first in the settings.';
			return;
		}
		const contents = this.buildGeminiContentsFormat(
			request.userMessage,
			request.historyMessages || []
		);
		const systemInstruction = this.buildSystemInstruction(
			request.systemInstruction || this.llmConfig.systemInstruction
		);

		let temperature: number;
		if (request.temperature === 0 || this.llmConfig.temperature === 0) {
			temperature = 0;
		} else {
			temperature = Math.min(
				request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),
				this.getMaxTemperature()
			);
		}

		const model = this.genAI.getGenerativeModel({
			model: request.model || this.llmConfig.model || 'gemini-2.0-flash-thinking-exp',
			generationConfig: {
				...this.llmConfig.generationConfig,
				...request.generationConfig,
				temperature
			},
			safetySettings
		});
		if (this.llmConfig.language) {
			const languageInstruction = LANGUAGE_PROMPT + this.llmConfig.language;
			systemInstruction.parts.push({ text: languageInstruction });
		}

		let result: GenerateContentResult;
		try {
			if (model.model.includes('thinking') && getIsGeminiThinkingOverloaded()) {
				//fallback early to avoid waiting for the response
				throw new Error(
					'Gemini Thinking is overloaded! Fallback early to avoid waiting for the response.'
				);
			}
			result = await model.generateContent({ contents, systemInstruction });
		} catch (e) {
			if (e instanceof Error) {
				if (e.message.includes('API key not valid')) {
					handleError(e as unknown as string);
					return undefined;
				}
				if (e.message.includes('503') || e.message.includes('500')) {
					if (model.model?.includes('thinking')) {
						setIsGeminiThinkingOverloaded(true);
					} else {
						setIsGeminiFlashExpOverloaded(true);
					}
					e.message =
						'The Gemini AI is overloaded! You can try again or wait some time. Alternatively, you can go to the settings and enable the fallback.';
				}
				if (this.fallbackLLM) {
					console.log('Fallback LLM for error: ', e.message);
					const fallbackResult = await this.fallbackLLM.generateReasoningContent(request);
					if (!fallbackResult) {
						handleError(e as unknown as string);
					} else {
						fallbackResult['fallbackUsed'] = true;
					}
					return fallbackResult;
				} else {
					handleError(e as unknown as string);
					return undefined;
				}
			}
			handleError(e as string);
			return undefined;
		}
		try {
			let reasoning;
			let json;
			if (result.response?.candidates) {
				if (result.response.candidates[0].content.parts.length > 1) {
					reasoning = result.response.candidates[0].content.parts[0].text;
					json = result.response.candidates[0].content.parts[1].text;
				} else {
					//for some reason no thoughts present
					json = result.response.candidates[0].content.parts[0].text;
				}
			} else {
				handleError('Gemini did not send a response...');
				return undefined;
			}
			try {
				return {
					reasoning,
					parsedObject: JSON.parse(json.replaceAll('```json', '').replaceAll('```', ''))
				};
			} catch (firstError) {
				try {
					console.log('Error parsing JSON: ' + json, firstError);
					console.log('Try json simple fix 1');
					if (
						(firstError as SyntaxError).message.includes('Bad control character in string literal')
					) {
						return { reasoning, parsedObject: JSON.parse(json.replaceAll('\\', '')) };
					}
					return { reasoning, parsedObject: JSON.parse('{' + json.replaceAll('\\', '')) };
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
				} catch (secondError) {
					//autofix if true or not set and llm allows it
					if (
						(request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
						this.llmConfig.tryAutoFixJSONError
					) {
						console.log('Try json fix with llm agent');
						return {
							reasoning,
							parsedObject: this.jsonFixingInterceptorAgent.fixJSON(
								json,
								(firstError as SyntaxError).message
							)
						};
					}
					handleError(firstError as string);
					return undefined;
				}
			}
		} catch (e) {
			handleError(e as string);
		}
		return undefined;
	}

	async generateContent(request: LLMRequest): Promise<object | undefined> {
		return (await this.generateReasoningContent(request))?.parsedObject;
	}

	buildSystemInstruction(systemInstruction?: Array<string> | string): Content {
		const instruction = { role: 'systemInstruction', parts: [] as Array<Part> };
		if (!systemInstruction) return instruction;
		if (typeof systemInstruction === 'string') {
			instruction.parts.push({ text: systemInstruction });
		} else {
			systemInstruction.forEach((instr) => instruction.parts.push({ text: instr }));
		}
		return instruction;
	}

	buildGeminiContentsFormat(actionText: string, historyMessages: Array<LLMMessage>): Content[] {
		const contents: Content[] = [];
		if (historyMessages) {
			historyMessages.forEach((message) => {
				//TODO why can one of these not be present?
				if (message && message.role && message.content) {
					contents.push({
						role: message.role,
						parts: [{ text: message.content }]
					});
				}
			});
		}
		if (actionText) {
			const message = { role: 'user', content: actionText };
			contents.push({
				role: message.role,
				parts: [{ text: message.content || '' }]
			});
		}
		return contents;
	}
}
