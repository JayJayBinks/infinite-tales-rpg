import {handleError} from "../util.svelte";
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

    sendToAI(contents: any,
             systemInstruction: any,
             temperature: number,
             tryAutoFixJSONError: boolean): Promise<any>;

    sendToAI(contents: any,
             systemInstruction: any,
             temperature: number,
             useGenerationConfig: any,
             useSafetySettings: any,
             tryAutoFixJSONError: boolean): Promise<any>;
}

export class GeminiProvider implements LLMProvider {
    apiKey: string;
    language: string;
    systemInstruction: any;
    temperature: number;
    generationConfig: any;
    safetySettings: any;

    jsonFixingInterceptorAgent: JsonFixingInterceptorAgent;

    constructor(apiKey: string, temperature: number = generationConfig.temperature, language: string, systemInstruction: any = undefined, useGenerationConfig: any = generationConfig, useSafetySettings: any = safetySettings) {
        this.apiKey = apiKey;
        this.temperature = temperature;
        this.language = language;
        this.systemInstruction = systemInstruction;
        this.generationConfig = useGenerationConfig;
        this.safetySettings = useSafetySettings;

        this.jsonFixingInterceptorAgent = new JsonFixingInterceptorAgent(this);
    }

    async sendToAINoAutoFix(contents: any,
                            systemInstruction: any = this.systemInstruction,
                            temperature: number = this.temperature): Promise<any> {
        return this.sendToAI(contents,
            systemInstruction,
            temperature,
            this.generationConfig,
            this.safetySettings,
            false);
    }

    async sendToAI(contents: any,
                   systemInstruction: any = this.systemInstruction,
                   temperature: number = this.temperature,
                   useGenerationConfig: any = this.generationConfig,
                   useSafetySettings: any = this.safetySettings,
                   tryAutoFixJSONError: boolean = true): Promise<any> {

        const url = `https://text.pollinations.ai/openai`;
        const body = JSON.stringify({
            messages: [
                { role: 'system', content: extractSystemPrompt(systemInstruction) },
                { role: 'user', content: transformMessagesToContent(contents) }
            ],
            temperature: temperature,
            model: 'mistral-large',
            response_format: { type: 'json_object' },
        });

        let result;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });
            result = await response.json();
        } catch (e) {
            if (e instanceof Error && e.message.includes('not available in your country')) {
                e.message = "The Pollinations AI Free Tier is not available in your country. :( Better move to a different country, there are browser extensions which support you!";
            }
            handleError(e);
            return undefined;
        }
        try {
            const responseText = result.choices[0].message.content;
            if (useGenerationConfig.responseMimeType === 'application/json') {
                try {
                    return JSON.parse(responseText.replaceAll('```json', '').replaceAll('```', ''));
                } catch (firstError) {
                    if (firstError instanceof Error) {
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
            }
            return responseText;
        } catch (e) {
            handleError(e);
        }
        return undefined;
    }
}

export function buildAIContentsFormat(actionText: any, historyMessages: any): any {
    let contents = []
    if (historyMessages) {
        historyMessages.forEach((message: any) => {
            contents.push({
                "role": message["role"],
                "content": message["content"]
            })
        });
    }
    if (actionText) {
        let message = {"role": "user", "content": actionText}
        contents.push({
            "role": message["role"],
            "content": message["content"]
        })
    }
    return contents;
}

function transformMessagesToContent(messages: any): string {
    return messages.map((message: any) => message.content ? message.content : message.parts.map((part: any) => part.text).join('\n')).join('\n');
}

 function extractSystemPrompt(messages: any): string {
    return messages.parts.map((part: any) => part.text).join('\n')
}