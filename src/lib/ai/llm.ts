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
	generationConfig?: GenerationConfig;
	safetySettings?: Array<SafetySetting>;
	tryAutoFixJSONError?: boolean;
	model?: string;
}

export interface LLMconfig {
	provider?: 'gemini' | 'pollinations';
	temperature?: number;
	generationConfig?: GenerationConfig;
	language?: string;
	systemInstruction?: string[] | string;
	tryAutoFixJSONError?: boolean;
	apiKey?: string;
	model?: string;
}

export type LLMReasoningResponse = { reasoning: string | undefined; parsedObject: object };

export const LANGUAGE_PROMPT =
	'Important! Each JSON key must stay as english but the value must be translated; Enums (fully capitalized value) must always remain in English! Translate to following language: ';

export abstract class LLM {
	llmConfig: LLMconfig;

	protected constructor(llmConfig: LLMconfig) {
		this.llmConfig = llmConfig;
	}

	abstract generateReasoningContent(request: LLMRequest): Promise<LLMReasoningResponse | undefined>;

	abstract generateContent(request: LLMRequest): Promise<object | undefined>;

	abstract getDefaultTemperature(): number;

	abstract getMaxTemperature(): number;
}
