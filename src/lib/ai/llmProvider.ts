import { defaultGeminiJsonConfig, GeminiProvider } from '$lib/ai/geminiProvider';
import { LLM, type LLMconfig } from '$lib/ai/llm';
import { PollinationsProvider } from '$lib/ai/pollinationsProvider';

export const defaultLLMConfig: LLMconfig = {
	provider: 'gemini',
	temperature: defaultGeminiJsonConfig.temperature,
	generationConfig: defaultGeminiJsonConfig,
	tryAutoFixJSONError: true
};

export class LLMProvider {
	static provideLLM(llmConfig: LLMconfig, useFallback: boolean = false): LLM {
		const configToUse: LLMconfig = { ...defaultLLMConfig, ...llmConfig };
		if (configToUse.provider === 'pollinations') {
			return new PollinationsProvider(configToUse);
		} else {
			return new GeminiProvider(
				configToUse,
				new PollinationsProvider(
					{ ...configToUse, model: 'gemini-thinking' },
					useFallback ? new PollinationsProvider(configToUse) : undefined
				)
			);
		}
	}

	static provideDefaultLLM(useFallback: boolean = false): LLM {
		return new GeminiProvider(
			defaultLLMConfig,
			new PollinationsProvider(
				{ ...defaultLLMConfig, model: 'gemini-thinking' },
				useFallback ? new PollinationsProvider(defaultLLMConfig) : undefined
			)
		);
	}
}
