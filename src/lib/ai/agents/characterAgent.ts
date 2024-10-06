import {stringifyPretty} from "$lib/util.svelte";
import type {LLM, LLMRequest} from "$lib/ai/llm";

export type CharacterState = typeof characterStateForPrompt;
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

    llm: LLM;
    constructor(llm: LLM) {
        this.llm = llm;
    }

    async generateCharacterDescription(storyState: object, characterOverwrites: Partial<CharacterState> | undefined = undefined) : Promise<CharacterState> {
        const agentInstruction = "You are RPG character agent, describing a character according to game system, adventure and character description.\n" +
            "Always respond with following JSON!\n" +
            stringifyPretty(characterStateForPrompt);

        const preset = {
            ...storyState,
            ...characterOverwrites
        }
        const request: LLMRequest = {
            userMessage: "Create the character: " + stringifyPretty(preset),
            systemInstruction: agentInstruction,
        }
        return await this.llm.generateContent(request);
    }

}
