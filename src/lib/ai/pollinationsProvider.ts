import { handleError } from '../util.svelte';
import { JsonFixingInterceptorAgent } from './agents/jsonFixingInterceptorAgent';
import {
	LLM,
	type LLMconfig,
	type LLMMessage,
	type LLMRequest,
	LANGUAGE_PROMPT
} from '$lib/ai/llm';
import isPlainObject from 'lodash.isplainobject';
import type { GenerateContentConfig } from '@google/genai';

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
		this.model = llmConfig.model || 'openai';
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
		this.fallbackLLM = fallbackLLM;
	}

	getDefaultTemperature(): number {
		return 1.1;
	}

	getMaxTemperature(): number {
		return 2;
	}

	generateContentStream(request: LLMRequest, storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void): Promise<object | undefined> {
		throw new Error('Method not implemented.');
	}

	async generateContent(request: LLMRequest): Promise<object | undefined> {
		const contents = this.buildContentsFormat(request.userMessage, request.historyMessages || []);
		const systemInstructions = this.buildSystemInstruction(
			request.systemInstruction || this.llmConfig.systemInstruction
		);
		if (this.llmConfig.language) {
			const languageInstruction = LANGUAGE_PROMPT + this.llmConfig.language;
			systemInstructions.push({ role: 'system', content: languageInstruction });
		}

		const temperature = Math.min(
			request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),
			this.getMaxTemperature()
		);
		console.log('calling llm with temperature', temperature);
		const url = `https://text.pollinations.ai`;
		const body: any = {
			messages: [...systemInstructions, ...contents],
			temperature,
			model: this.model
		};
		if (this.model !== 'gemini-thinking' && this.model !== 'openai-reasoning') {
			body.response_format = { type: 'json_object' };
		}
		let result;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});
			if (response.status === 500) {
				throw new Error(await response.text());
			}
			result = response;
		} catch (e: any) {
			const fallbackMessage = `Fallback Pollinations Gemini Thinking failed... You can go to the settings and enable GPT-4o-mini as fallback.`;
			e.message = fallbackMessage + ' ' + (e as Error).message;
			if (this.fallbackLLM) {
				console.log('Pollinations Fallback LLM for error: ', this.model, e.message);
				const fallbackResult = await this.fallbackLLM.generateContent(request);
				if (!fallbackResult) {
					handleError(e as unknown as string);
				} else {
					if (this.model === 'openai') {
						fallbackResult['fallbackUsed'] = true;
					}
				}
				return fallbackResult;
			} else {
				handleError(e as unknown as string);
				return undefined;
			}
		}
		try {
			const response: Response = result;
			const autoFixJSON =
				((request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
					this.llmConfig.tryAutoFixJSONError) ||
				false;
			return this.parseContentByModel(this.model, response, autoFixJSON);
		} catch (e) {
			handleError(e as string);
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

	parseDeepseek(response: any, autoFixJSON: boolean) {
		if (isPlainObject(response)) {
			return response;
		}
		return this.parseJSON(response, autoFixJSON);
	}

	parseOpenAI(response: any, autoFixJSON: boolean) {
		if (!response.choices) {
			return response;
		}
		const responseText = response.choices[0].message.content;
		return this.parseJSON(responseText, autoFixJSON);
	}

	parseGeminiThinking(response: string, autoFixJSON: boolean) {
		return this.parseJSON(response, autoFixJSON);
	}

	parseJSON(response: string, autoFix: boolean) {
		try {
			return JSON.parse(
				response.replaceAll('```json', '').replaceAll('```html', '').replaceAll('```', '').trim()
			);
		} catch (firstError) {
			//autofix if true or not set and llm allows it
			if (autoFix) {
				console.log('Try json fix with llm agent');
				return this.jsonFixingInterceptorAgent.fixJSON(
					response,
					(firstError as SyntaxError).message
				);
			}
			handleError(firstError as string);
			return undefined;
		}
	}

	async parseContentByModel(model: string, response: Response, autoFixJson: boolean) {
		switch (model) {
			case 'deepseek-r1':
				return this.parseDeepseek(await response.json(), autoFixJson);
			case 'openai':
			case 'openai-large':
				return this.parseOpenAI(await response.json(), autoFixJson);
			default:
				return this.parseJSON(await response.text(), autoFixJson);
		}
	}
}
