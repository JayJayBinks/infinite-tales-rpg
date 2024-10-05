import {defaultGeminiJsonConfig, GeminiProvider} from "$lib/ai/geminiProvider";
import {LLM, type LLMconfig} from "$lib/ai/llm";


export const defaultLLMConfig: LLMconfig = {
    provider: 'gemini',
    temperature: defaultGeminiJsonConfig.temperature,
    generationConfig: defaultGeminiJsonConfig,
    tryAutoFixJSONError: true,
}

export class LLMProvider {
    static provideLLM(llmConfig: LLMconfig): LLM {
        const configToUse = {...defaultLLMConfig, ...llmConfig}
        if (llmConfig.provider === 'pollinations') {
            //TODO impl pollinations
            return new GeminiProvider(configToUse);
        } else {
            return new GeminiProvider(configToUse);
        }
    }

    static provideDefaultLLM(): LLM {
        return new GeminiProvider(defaultLLMConfig);
    }
}
