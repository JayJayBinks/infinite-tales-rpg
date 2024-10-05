import {handleError} from "../util.svelte";
import {
    type Content,
    type GenerationConfig,
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory, type Part,
    type SafetySetting
} from "@google/generative-ai";
import {JsonFixingInterceptorAgent} from "./agents/jsonFixingInterceptorAgent";
import {LLM, type LLMconfig, type LLMMessage, type LLMRequest} from "$lib/ai/llm";

const safetySettings: Array<SafetySetting> = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

export const defaultGeminiJsonConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};
export const defaultGeminiTextConfig: GenerationConfig = {
    ...defaultGeminiJsonConfig,
    maxOutputTokens: 4000,
    responseMimeType: "text/plain",
};

export class GeminiProvider extends LLM {
    genAI : GoogleGenerativeAI;
    jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;

    constructor(llmConfig : LLMconfig) {
        super(llmConfig);
        this.genAI = new GoogleGenerativeAI(this.llmConfig.apiKey || '');
        this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
    }

    getDefaultTemperature() : number {
        return defaultGeminiJsonConfig.temperature as number;
    }
    getMaxTemperature() : number {
        return 2;
    }

    async generateContent(request: LLMRequest): Promise<any | undefined> {
        const contents = this.buildGeminiContentsFormat(request.userMessage, request.historyMessages || []);
        const systemInstruction = this.buildSystemInstruction(request.systemInstruction || this.llmConfig.systemInstruction);
        const model = this.genAI.getGenerativeModel({
            model: request.model || this.llmConfig.model || "gemini-1.5-flash-latest",
            generationConfig: {...this.llmConfig.generationConfig, ...request.generationConfig,
                temperature: Math.min(request.temperature || this.llmConfig.temperature || this.getDefaultTemperature(),  this.getMaxTemperature())},
            safetySettings
        });
        if (this.llmConfig.language) {
            const languageInstruction = 'Important! You must respond in the following language: ' + this.llmConfig.language;
            systemInstruction.parts.push({"text": languageInstruction});
        }

        let result;
        try {
            result = await model.generateContent({contents, systemInstruction});
        } catch (e) {
            handleError(e);
            return undefined;
        }
        try {
            const responseText = result.response.text();
            if (model.generationConfig.responseMimeType === 'application/json') {
                try {
                    return JSON.parse(responseText.replaceAll('```json', '').replaceAll('```', ''));
                } catch (firstError) {
                    try {
                        console.log("Error parsing JSON: " + responseText, firstError)
                        console.log("Try json simple fix 1")
                        if ((firstError as SyntaxError).message.includes('Bad control character in string literal')) {
                            return JSON.parse(responseText.replaceAll("\\", ""));
                        }
                        return JSON.parse("{" + responseText.replaceAll("\\", ""));
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (secondError) {
                        if (request.tryAutoFixJSONError || this.llmConfig.tryAutoFixJSONError) {
                            console.log("Try json fix with llm agent")
                            return this.jsonFixingInterceptorAgent.fixJSON(responseText, (firstError as SyntaxError).message);
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

    buildSystemInstruction(systemInstruction?: Array<string> | string): Content {
        const instruction = {role: 'systemInstruction', parts: [] as Array<Part>}
        if (!systemInstruction) return instruction;
        if (typeof systemInstruction === "string") {
            instruction.parts.push({"text": systemInstruction});
        } else {
            systemInstruction.forEach(instr => instruction.parts.push({"text": instr}));
        }
        return instruction;
    }

    buildGeminiContentsFormat(actionText: string, historyMessages: Array<LLMMessage>): Content[] {
        const contents = []
        if (historyMessages) {
            historyMessages.forEach(message => {
                contents.push({
                    "role": message["role"],
                    "parts": [{"text": message["content"]}]
                })
            });
        }
        if (actionText) {
            const message = {role: "user", content: actionText};
            contents.push({
                "role": message["role"],
                "parts": [{"text": message["content"]}]
            })
        }
        return contents;
    }
}