import { defaultGeminiJsonConfig, GEMINI_MODELS, GeminiProvider } from '$lib/ai/geminiProvider';
import { LLM, type LLMconfig } from '$lib/ai/llm';
import { PollinationsProvider } from '$lib/ai/pollinationsProvider';

export const defaultLLMConfig: LLMconfig = {
	provider: 'gemini',
	temperature: defaultGeminiJsonConfig.temperature,
	config: defaultGeminiJsonConfig,
	tryAutoFixJSONError: true
};

export class LLMProvider {
	static provideLLM(llmConfig: LLMconfig): LLM {
		const configToUse: LLMconfig = { ...defaultLLMConfig, ...llmConfig };
		if (configToUse.provider === 'pollinations') {
			// Cast to LLM interface for compatibility
			return new PollinationsProvider({ ...configToUse, model: 'openai' }) as unknown as LLM;
		}
		// Always enable full fallback chain
		return new GeminiProvider(
			configToUse,
			new GeminiProvider(
				{ ...configToUse, model: GEMINI_MODELS.FLASH_LITE_2_5 },
				new GeminiProvider({ ...configToUse, model: GEMINI_MODELS.FLASH_THINKING_2_0 })
			)
		);
	}
}
