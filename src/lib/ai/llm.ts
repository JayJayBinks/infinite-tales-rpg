import {stringifyPretty} from '$lib/util.svelte.ts'
import {aiState} from "../state/aiState.svelte";
import {handleError} from "../util.svelte";

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

export async function sendToAI(systemInstruction, contents, useGenerationConfig = generationConfig) {
    try {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent"
            + "?key=" + aiState.apiKey;
        const response: Response = await fetch(url, {
            method: 'POST',
            body: stringifyPretty({
                systemInstruction: systemInstruction,
                contents: contents,
                generationConfig: {...useGenerationConfig, temperature: aiState.temperature},
                safety_settings: safetySettings
            })
        });
        if (response.status >= 400 && response.status < 600) {
            throw new Error(await response.text());
        }
        const data = await response.json();
        const jsonText = data["candidates"][0]["content"]["parts"][0]["text"]
        return jsonText;
    } catch (e) {
        handleError(e)
    }
    return undefined;
}