import { defaultGeminiJsonConfig, GeminiProvider } from '$lib/ai/geminiProvider';
import { LLM, type LLMconfig } from '$lib/ai/llm';
import { GPT4Provider } from '$lib/ai/gpt4Provider';

export const defaultLLMConfig: LLMconfig = {
	provider: 'gemini',
	temperature: defaultGeminiJsonConfig.temperature,
	generationConfig: defaultGeminiJsonConfig,
	tryAutoFixJSONError: true
};

export class LLMProvider {
	static provideLLM(llmConfig: LLMconfig): LLM {
		const configToUse: LLMconfig = { ...defaultLLMConfig, ...llmConfig };
		if (configToUse.provider === 'gpt4') {
			return new GPT4Provider(configToUse);
		} else {
			return new GeminiProvider(configToUse);
		}
	}

	static provideDefaultLLM(): LLM {
		return new GeminiProvider(defaultLLMConfig);
	}
}
