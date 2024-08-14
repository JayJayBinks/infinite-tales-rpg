import {handleError} from "../util.svelte";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {JsonFixingInterceptorAgent} from "./agents/jsonFixingInterceptorAgent";

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
    temperature: 1,
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
             tryAutoFixJSONError);

    sendToAI(contents,
             systemInstruction,
             temperature,
             useGenerationConfig,
             useSafetySettings,
             tryAutoFixJSONError);
}


export class GeminiProvider implements LLMProvider {
    apiKey: string;
    systemInstruction: any; // TODO The requested module '@google/generative-ai' does not provide an export named 'Part'
    temperature: number;
    generationConfig;
    safetySettings;

    genAI;
    jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;


    constructor(apiKey, temperature: number = generationConfig.temperature, systemInstruction = undefined, useGenerationConfig = generationConfig, useSafetySettings = safetySettings) {
        this.apiKey = apiKey;
        this.systemInstruction = systemInstruction;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.temperature = temperature;
        this.generationConfig = useGenerationConfig;
        this.safetySettings = useSafetySettings;

        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
    }

    async sendToAINoAutoFix(contents,
                   systemInstruction = this.systemInstruction,
                   temperature = this.temperature) {
        return this.sendToAI(contents,
            systemInstruction,
            temperature,
            this.generationConfig,
            this.safetySettings,
            false);
    }

    async sendToAI(contents,
                   systemInstruction = this.systemInstruction,
                   temperature = this.temperature,
                   useGenerationConfig = this.generationConfig,
                   useSafetySettings = this.safetySettings,
                   tryAutoFixJSONError = true) {

        const model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            generationConfig: {...useGenerationConfig, temperature},
            safetySettings: useSafetySettings
        });

        let result;
        try {
            result = await model.generateContent({contents, systemInstruction});
        } catch (e) {
            if(e.message.includes('not available in your country')){
                e.message = "The Google Gemini Free Tier is not available in your country. :( Better move to a different country, there are browser extensions which support you!";
            }
            handleError(e);
            return undefined;
        }
        try {
            const responseText = result.response.text();
            if (useGenerationConfig.responseMimeType === 'application/json') {
                try {
                    return JSON.parse(responseText.replaceAll('```json', '').replaceAll('```', ''));
                } catch (firstError) {
                    try {
                        console.log("Error parsing JSON: " + responseText, firstError)
                        console.log("Try json simple fix 1")
                        if (firstError.message.includes('Bad control character in string literal')) {
                            return JSON.parse(responseText.replaceAll("\\", ""));
                        }
                        return JSON.parse("{" + responseText.replaceAll("\\", ""));
                    } catch (secondError) {
                        if (tryAutoFixJSONError) {
                            console.log("Try json fix with llm agent")
                            return this.jsonFixingInterceptorAgent.fixJSON(responseText, firstError.message);
                        }
                        handleError(firstError);
                        return undefined;
                    }
                }
            }
            return responseText;
        } catch (e) {
            handleError(e);
        }
        return undefined;
    }
}