import JSONParser from '@streamparser/json/jsonparser.js';
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

type OpenAIChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export class OpenAICompatibleProvider extends LLM {
	private readonly jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;

	constructor(llmConfig: LLMconfig) {
		super(llmConfig);
		this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
	}

	getDefaultTemperature(): number {
		return 0.8;
	}

	getMaxTemperature(): number {
		return 2;
	}

	private getBaseUrl(): string {
		const configured = this.llmConfig.baseUrl?.trim();
		if (!configured) return 'http://localhost:1234';
		return configured.replace(/\/$/, '');
	}

	private isGeminiModelName(model?: string): boolean {
		return typeof model === 'string' && model.trim().startsWith('gemini-');
	}

	private getModelToUse(request: LLMRequest): string {
		const requested = request.model?.trim();
		if (requested && !this.isGeminiModelName(requested)) return requested;
		const configured = this.llmConfig.model?.trim();
		if (configured) return configured;
		return 'google/gemma-3-4b';
	}

	private buildMessages(request: LLMRequest): OpenAIChatMessage[] {
		const messages: OpenAIChatMessage[] = [];

		const systemInstructions = request.systemInstruction ?? this.llmConfig.systemInstruction;
		if (typeof systemInstructions === 'string' && systemInstructions.trim()) {
			messages.push({ role: 'system', content: systemInstructions });
		} else if (Array.isArray(systemInstructions)) {
			for (const instr of systemInstructions) {
				if (instr?.trim()) messages.push({ role: 'system', content: instr });
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
		reportErrorToUser: boolean
	): Promise<object | undefined> {
		const cleaned = this.stripCodeFences(responseText);
		try {
			return sanitizeAnndParseJSON(cleaned);
		} catch (firstError) {
			if (autoFix) {
				try {
					return (await this.jsonFixingInterceptorAgent.fixJSON(
						responseText,
						(firstError as SyntaxError).message,
						reportErrorToUser
					)) as object | undefined;
				} catch (secondError) {
					if (reportErrorToUser) handleError(secondError as unknown as string);
					return undefined;
				}
			}
			if (reportErrorToUser) handleError(firstError as unknown as string);
			return undefined;
		}
	}

	async generateContent(request: LLMRequest): Promise<ContentWithThoughts | undefined> {
		const baseUrl = this.getBaseUrl();
		const url = `${baseUrl}/v1/chat/completions`;
		const messages = this.buildMessages(request);
		const model = this.getModelToUse(request);
		const temperature = this.clampTemperature(request);

		const body: any = {
			model,
			messages,
			temperature,
			stream: false
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (this.llmConfig.apiKey?.trim()) {
			headers.Authorization = `Bearer ${this.llmConfig.apiKey}`;
		}

		let response: Response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});
		} catch (e) {
			if (request.reportErrorToUser !== false) handleError(e as unknown as string);
			return undefined;
		}

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			if (request.reportErrorToUser !== false) {
				handleError(`Local LLM request failed: ${response.status} ${response.statusText} ${text}`);
			}
			return undefined;
		}

		const json = (await response.json()) as any;
		const responseText: string | undefined = json?.choices?.[0]?.message?.content;
		if (!responseText) {
			if (request.reportErrorToUser !== false) handleError('Local LLM did not return any text.');
			return undefined;
		}

		const autoFixJson =
			((request.tryAutoFixJSONError ?? true) && (this.llmConfig.tryAutoFixJSONError ?? false)) ||
			false;
		const parsed = await this.parseJsonOrFix(
			responseText,
			autoFixJson,
			request.reportErrorToUser !== false
		);
		if (!parsed) return undefined;
		return { thoughts: '', content: parsed };
	}

	async generateContentStream(
		request: LLMRequest,
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void
		// local OpenAI-compatible providers typically do not support separate "thoughts" channels
	): Promise<object | undefined> {
		const baseUrl = this.getBaseUrl();
		const url = `${baseUrl}/v1/chat/completions`;
		const messages = this.buildMessages(request);
		const model = this.getModelToUse(request);
		const temperature = this.clampTemperature(request);

		const body: any = {
			model,
			messages,
			temperature,
			stream: true
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (this.llmConfig.apiKey?.trim()) {
			headers.Authorization = `Bearer ${this.llmConfig.apiKey}`;
		}

		let response: Response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});
		} catch (e) {
			if (request.reportErrorToUser !== false) handleError(e as unknown as string);
			return undefined;
		}

		if (!response.ok || !response.body) {
			const text = await response.text().catch(() => '');
			if (request.reportErrorToUser !== false) {
				handleError(`Local LLM stream failed: ${response.status} ${response.statusText} ${text}`);
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

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

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

		let streamEnded = false;
		while (!streamEnded) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			// Parse Server-Sent Events: split by double newline
			let eventSepIndex = buffer.indexOf('\n\n');
			while (eventSepIndex !== -1) {
				const rawEvent = buffer.slice(0, eventSepIndex);
				buffer = buffer.slice(eventSepIndex + 2);

				for (const line of rawEvent.split('\n')) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data:')) continue;
					const data = trimmed.slice('data:'.length).trim();
					if (!data) continue;
					if (data === '[DONE]') {
						streamEnded = true;
						break;
					}

					let parsed: any;
					try {
						parsed = JSON.parse(data);
					} catch {
						continue;
					}

					const deltaText: string | undefined =
						parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content;
					if (typeof deltaText !== 'string' || deltaText.length === 0) continue;

					if (!jsonStarted) {
						const idxObj = deltaText.indexOf('{');
						const idxArr = deltaText.indexOf('[');
						let idx = -1;
						if (idxObj === -1 && idxArr === -1) continue;
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
				if (streamEnded) break;

				eventSepIndex = buffer.indexOf('\n\n');
			}
		}

		try {
			reader.releaseLock();
		} catch {
			// ignore
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

		// Basic cleanup
		const cleaned = this.stripCodeFences(accumulatedJsonText).replaceAll('```', '').trim();
		const autoFixJson =
			((request.tryAutoFixJSONError ?? true) && (this.llmConfig.tryAutoFixJSONError ?? false)) ||
			false;
		const finalObj = await this.parseJsonOrFix(
			cleaned,
			autoFixJson,
			request.reportErrorToUser !== false
		);
		if (!finalObj) {
			if (request.reportErrorToUser !== false && liveParserFailure) {
				handleError(
					`Stream JSON was not incrementally parseable (startedWith=${startedWith ?? 'unknown'}). Final parse failed too: ${liveParserFailure}`
				);
			}
			return undefined;
		}
		const finalStory = typeof (finalObj as any)?.story === 'string' ? (finalObj as any).story : '';
		storyUpdateCallback(finalStory, true);
		return finalObj as object;
	}
}
