import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider} from "../llmProvider";



export const characterStateForPrompt = {
    name: "",
    race: "",
    appearance: "",
    alignment: "",
    class: "",
    traits: 'list of the beginning traits of the character in following format: {"trait1": startingValue1, "trait2": startingValue2, ...}',
    abilities: "Abilities and spells of the character",
    expertise: 'Traits where CHARACTER has a high value and a positive dice roll modifier format: {"trait1": value between 1-5, "trait2": 1-5, ...}',
    disadvantages: 'Traits where CHARACTER has a low value and a negative dice roll modifier format: {"trait1": value between -1 to -5, "trait2": -1 to -5, ...}',
    personality: "",
    background: "",
    motivation: ""
}

export class CharacterAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async generateCharacterStats(storyState, characterOverwrites) {
        let agentInstruction = "You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n" +
            "Always respond with following JSON!\n" +
            stringifyPretty(characterStateForPrompt);

        let preset = {
            ...storyState,
            ...characterOverwrites
        }

        const jsonText = await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Create the character: " + stringifyPretty(preset)}]
            }],
            agentInstruction
        );
        if (jsonText) {
            try {
                return JSON.parse(jsonText);
            } catch (e) {
                handleError(e);
            }
        }
        return undefined;
    }

}
