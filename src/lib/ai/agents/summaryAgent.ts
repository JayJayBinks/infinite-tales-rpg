import {stringifyPretty} from "$lib/util.svelte";
import type {LLM, LLMMessage, LLMRequest} from "$lib/ai/llm";
import {defaultGeminiTextConfig} from "$lib/ai/geminiProvider";

export class SummaryAgent {

    llm: LLM;
    constructor(llm: LLM) {
        this.llm = llm;
    }

    /**
     * Keep first and last numOfLastActions and summarize everything in the middle
     * @param historyMessages
     * @param startSummaryAtSize Start summarizing the story when historyMessages reaches a certain size, each action has 2 parts, user and model message
     * @param numOfLastActions number of last actions to keep for detailed memory
     */
    async summarizeStoryIfTooLong(historyMessages: Array<LLMMessage>, startSummaryAtSize = 12 * 2, numOfLastActions = 4 * 2) : Promise<Array<LLMMessage>> {
        if (historyMessages.length < startSummaryAtSize) {
            return historyMessages;
        }
        const agent = "You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story." +
            " Summarize the story so the most important events and characters can be introduced to a storytelling AI."

        const toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);
        const request : LLMRequest = {
            userMessage : "Summarize the following story: \n" + stringifyPretty(toSummarize),
            systemInstruction : agent,
            temperature : 1,
            generationConfig : defaultGeminiTextConfig,
            tryAutoFixJSONError : false,
        }
        const text = await this.llm.generateContent(request);
        console.log(("Summary returned " + text))
        const newHistory = historyMessages.slice(0, 2)
        newHistory.push({role: "user", content: text});
        historyMessages.slice((numOfLastActions + 1) * -1).forEach(message => newHistory.push(message));
        return newHistory;
    }

}
