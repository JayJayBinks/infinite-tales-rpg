import {stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider, generationConfigText} from "../llmProvider";

export class SummaryAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async summarizeHistoryMessages(historyMessages: Array<object>) {
        let agent = "You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story." +
            " Summarize the story so the most important events and characters can be introduced to a storytelling AI."

        const text = await this.llmProvider.sendToAI({parts: [{"text": agent}]},
            {
                "role": "user",
                "parts": [{"text": "Summarize the following story: \n" + stringifyPretty(historyMessages)}]
            },
            1,
            generationConfigText
        );
        console.log(("Summary returned " + text))
        let newHistory = historyMessages.slice(0, 2)
        newHistory.push({role: "user", content: text});
        historyMessages.slice(-6).forEach(message => newHistory.push(message));
        return newHistory;
    }

}
