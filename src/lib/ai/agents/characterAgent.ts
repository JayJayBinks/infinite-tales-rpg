import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider} from "../llmProvider";



export const characterStateForPrompt = {
    name: "",
    class: "",
    race: "",
    gender: "",
    appearance: "",
    alignment: "",
    personality: "",
    background: "",
    motivation: ""
}

export class CharacterAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async generateCharacterDescription(storyState, characterOverwrites) {
        let agentInstruction = "You are RPG character agent, describing a character according to game system, adventure and character description.\n" +
            "Always respond with following JSON!\n" +
            stringifyPretty(characterStateForPrompt);

        let preset = {
            ...storyState,
            ...characterOverwrites
        }

        return await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Create the character: " + stringifyPretty(preset)}]
            }],
            {parts: [{"text": agentInstruction}]}
        );
    }

}
