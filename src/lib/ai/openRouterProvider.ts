import { handleError } from '../util.svelte';
import { type GenerationConfig } from '@google/generative-ai';
import { JsonFixingInterceptorAgent } from './agents/jsonFixingInterceptorAgent';
import { LLM, type LLMconfig, type LLMMessage, type LLMReasoningResponse, type LLMRequest } from '$lib/ai/llm';

export const defaultGPT4JsonConfig: GenerationConfig = {
	temperature: 1,
	topP: 0.95,
	topK: 40,
	maxOutputTokens: 8192,
	responseMimeType: 'application/json'
};

export class OpenRouterProvider extends LLM {
	jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;

	constructor(llmConfig: LLMconfig) {
		super(llmConfig);
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
	}

	getDefaultTemperature(): number {
		return defaultGPT4JsonConfig.temperature as number;
	}

	getMaxTemperature(): number {
		return 2;
	}

	async generateReasoningContent(request: LLMRequest): Promise<LLMReasoningResponse | undefined> {
		const contents = this.buildContentsFormat(request.userMessage, request.historyMessages || []);
		const systemInstructions = this.buildSystemInstruction(
			request.systemInstruction || this.llmConfig.systemInstruction
		);
		if (this.llmConfig.language) {
			const languageInstruction =
				'Important! For every JSON property you must respond in the following language: ' +
				this.llmConfig.language;
			systemInstructions.push({ role: 'system', content: languageInstruction });
		}

		let temperature = Math.min(
			request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),
			this.getMaxTemperature()
		);
		temperature = this.getDefaultTemperature();
		const body = JSON.stringify({
			messages: [...systemInstructions, ...contents],
			temperature,
			model: request.model || this.llmConfig.model,
			response_format: { type: 'json_object' },
			stream: false
		});
		let result;
		try {
			const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + this.llmConfig.apiKey,
					'Content-Type': 'application/json'
				},
				body
			});
			result = await response.json();
		} catch (e) {
			handleError(e as string);
			return undefined;
		}
		try {
			const response = result;
			const autoFixJSON =
				((request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
					this.llmConfig.tryAutoFixJSONError) ||
				false;
			return this.parseJSON(response.choices[0].message.content, autoFixJSON);
		} catch (e) {
			handleError(e as string);
		}
		return undefined;
	}

	async generateContent(request: LLMRequest): Promise<object | undefined> {
		return (await this.generateReasoningContent(request))?.parsedObject;
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

	parseJSON(response: string, autoFix: boolean) {
		const parts = response.includes('```json') ? response.split('```json') : [response];
		let reasoning: string | undefined = undefined;
		let json: string = parts[0];
		if (parts.length > 1) {
			reasoning = parts[0];
			json = parts[1];
		}
		try {
			return {
				reasoning,
				parsedObject: JSON.parse(json.replaceAll('```json', '').replaceAll('```', ''))
			};
		} catch (firstError) {
			//autofix if true or not set and llm allows it
			if (autoFix) {
				console.log('Try json fix with llm agent');
				return {
					reasoning,
					parsedObject: this.jsonFixingInterceptorAgent.fixJSON(
						response,
						(firstError as SyntaxError).message
					)
				};
			}
			handleError(firstError as string);
			return undefined;
		}
	}
}
