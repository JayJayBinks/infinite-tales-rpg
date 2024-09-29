import {stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider, generationConfigText} from "../llmProvider";

export class SummaryAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Keep first and last numOfLastActions and summarize everything in the middle
     * @param historyMessages
     * @param startSummaryAtSize Start summarizing the story when historyMessages reaches a certain size, each action has 2 parts, user and model message
     * @param numOfLastActions number of last actions to keep for detailed memory
     */
    async summarizeStoryIfTooLong(historyMessages: Array<object>, startSummaryAtSize = 12 * 2, numOfLastActions = 4 * 2) {
        if (historyMessages.length < startSummaryAtSize) {
            return historyMessages;
        }
        let agent = "You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story." +
            " Summarize the story so the most important events and characters can be introduced to a storytelling AI."

        let toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);

        const text = await this.llmProvider.sendToAI(
            [
                {
                    "role": "user",
                    "parts": [{"text": "Summarize the following story: \n" + stringifyPretty(toSummarize)}]
                }
            ],
            {parts: [{"text": agent}]},
            1,
            generationConfigText
        );
        console.log(("Summary returned " + text))
        let newHistory = historyMessages.slice(0, 2)
        newHistory.push({role: "user", content: text});
        historyMessages.slice((numOfLastActions + 1) * -1).forEach(message => newHistory.push(message));
        return newHistory;
    }

}
