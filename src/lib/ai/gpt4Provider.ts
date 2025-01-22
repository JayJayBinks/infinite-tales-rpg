import { handleError } from '../util.svelte';
import { type GenerationConfig } from '@google/generative-ai';
import { JsonFixingInterceptorAgent } from './agents/jsonFixingInterceptorAgent';
import {
	LLM,
	type LLMconfig,
	type LLMMessage,
	type LLMRequest,
	type LLMReasoningResponse
} from '$lib/ai/llm';

export const defaultGPT4JsonConfig: GenerationConfig = {
	temperature: 0.1,
	topP: 0.95,
	topK: 40,
	maxOutputTokens: 8192,
	responseMimeType: 'application/json'
};

export class GPT4Provider extends LLM {
	jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;

	constructor(llmConfig: LLMconfig) {
		super(llmConfig);
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
	}

	getDefaultTemperature(): number {
		return defaultGPT4JsonConfig.temperature as number;
	}

	getMaxTemperature(): number {
		return 1;
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
		console.log('calling llm with temperature', temperature);
		const url = `https://text.pollinations.ai/openai`;
		const body = JSON.stringify({
			messages: [...systemInstructions, ...contents],
			temperature,
			model: 'openai',
			seed: Math.floor(Math.random() * 1000000),
			response_format: { type: 'json_object' }
		});
		let result;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: body
			});
			result = await response.json();
		} catch (e) {
			handleError(e as string);
			return undefined;
		}
		try {
			const responseText = result.choices[0].message.content;
			if (this.llmConfig.generationConfig?.responseMimeType === 'application/json') {
				try {
					return {
						reasoning: undefined,
						parsedObject: JSON.parse(responseText.replaceAll('```json', '').replaceAll('```', ''))
					};
				} catch (firstError) {
					//autofix if true or not set and llm allows it
					if (
						(request.tryAutoFixJSONError || request.tryAutoFixJSONError === undefined) &&
						this.llmConfig.tryAutoFixJSONError
					) {
						console.log('Try json fix with llm agent');
						return {
							reasoning: undefined,
							parsedObject: this.jsonFixingInterceptorAgent.fixJSON(
								responseText,
								(firstError as SyntaxError).message
							)
						};
					}
					handleError(firstError as string);
					return undefined;
				}
			}
			return responseText;
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
}
