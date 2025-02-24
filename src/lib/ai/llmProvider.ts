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
			return new PollinationsProvider({ ...configToUse, model: 'openai' })
		} else {
			//fallback to flash-exp if thinking-exp fails and then to pollinations gpt-4o-mini
			return new GeminiProvider(
				configToUse,
				new PollinationsProvider(
					{ ...configToUse, model: 'gemini-thinking' },
					!useFallback
						? undefined
						: new GeminiProvider(
								{...configToUse, model: 'gemini-2.0-flash-exp'},
								new PollinationsProvider(configToUse)
							)
				)
			);
		}
	}
}
