import { defaultGeminiJsonConfig, GeminiProvider } from '$lib/ai/geminiProvider';
import { LLM, type LLMconfig } from '$lib/ai/llm';
import { PollinationsProvider } from '$lib/ai/pollinationsProvider';

export const defaultLLMConfig: LLMconfig = {
	provider: 'pollinations',
	temperature: defaultGeminiJsonConfig.temperature,
	generationConfig: defaultGeminiJsonConfig,
	tryAutoFixJSONError: true
};

export class LLMProvider {
	static provideLLM(llmConfig: LLMconfig): LLM {
		const configToUse: LLMconfig = { ...defaultLLMConfig, ...llmConfig };
		if (configToUse.provider === 'pollinations') {
			return new PollinationsProvider(configToUse);
		} else {
			return new GeminiProvider(configToUse);
		}
	}

	static provideDefaultLLM(): LLM {
		return new GeminiProvider(defaultLLMConfig);
	}
}
