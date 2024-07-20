
import {handleError} from "../util.svelte";
import {GoogleGenerativeAI,} from "@google/generative-ai";

const safetySettings = [
    {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
    },
];

export const generationConfig = {
    temperature: 2,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};
export const generationConfigText = {
    ...generationConfig,
    maxOutputTokens: 4000,
    responseMimeType: "text/plain",
};

export interface LLMProvider {
    sendToAI(contents,
             systemInstruction,
             temperature,
             useGenerationConfig,
             useSafetySettings);
}


export class GeminiProvider implements LLMProvider {
    apiKey: string;
    systemInstruction: string;
    temperature: number;
    generationConfig;
    safetySettings;

    genAI;

    constructor(apiKey, systemInstruction = undefined, temperature: number = generationConfig.temperature, useGenerationConfig = generationConfig, useSafetySettings = safetySettings) {
        this.apiKey = apiKey;
        this.systemInstruction = systemInstruction;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.temperature = temperature;
        this.generationConfig = useGenerationConfig;
        this.safetySettings = useSafetySettings;

        this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    async sendToAI(contents,
                   systemInstruction = this.systemInstruction,
                   temperature = this.temperature,
                   useGenerationConfig = this.generationConfig,
                   useSafetySettings = this.safetySettings) {

        const model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            generationConfig: {...useGenerationConfig, temperature},
            safetySettings: useSafetySettings
        });

        try {
            const result = await model.generateContent({contents, systemInstruction});
            return result.response.text();
            // if (response.status >= 400 && response.status < 600) {
            //     throw new Error(await response.text());
            // }
        } catch (e) {
            handleError(e);
        }
        return undefined;
    }
}