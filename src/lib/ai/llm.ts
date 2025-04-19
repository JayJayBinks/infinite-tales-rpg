import type { GenerateContentConfig } from '@google/genai';
import type { GenerationConfig, SafetySetting } from '@google/generative-ai';

export interface LLMMessage {
	role: 'user' | 'model';
	content: string;
}

export interface LLMRequest {
	userMessage: string;
	historyMessages?: Array<LLMMessage>;
	systemInstruction?: Array<string> | string;
	temperature?: number;
	config?: GenerateContentConfig;
	safetySettings?: Array<SafetySetting>;
	tryAutoFixJSONError?: boolean;
	model?: string;
	returnFallbackProperty?: boolean;
	stream?: boolean;
}

export interface LLMconfig {
	provider?: 'gemini' | 'pollinations';
	temperature?: number;
	config?: GenerateContentConfig;
	language?: string;
	systemInstruction?: string[] | string;
	tryAutoFixJSONError?: boolean;
	apiKey?: string;
	model?: string;
	returnFallbackProperty?: boolean;
}

export const LANGUAGE_PROMPT =
	'Important! Each JSON key must stay as english but the value must be translated; Enums (LOW, MEDIUM, HIGH, or any fully capitalized value) must always remain in English! Translate to following language: ';

export abstract class LLM {
	llmConfig: LLMconfig;

	protected constructor(llmConfig: LLMconfig) {
		this.llmConfig = llmConfig;
	}

	abstract generateContent(request: LLMRequest): Promise<object | undefined>;

	abstract generateContentStream(
		request: LLMRequest,
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void
	): Promise<object | undefined>;

	abstract getDefaultTemperature(): number;

	abstract getMaxTemperature(): number;
}
