import {handleError, stringifyPretty} from "../../util.svelte";
import {sendToAI} from "../llm";

export const characterStateForPrompt = {
    name: "",
    appearance: "",
    race: "",
    personality: "",
    background: "",
    alignment: "",
    motivation: "",
    class: "",
    traits: "list of the beginning traits of the character in following format: {trait1: startingValue1, trait2: startingValue2, ...}",
    abilities: "Abilities and spells of the character",
    expertise: "Traits where CHARACTER has a high value and a positive dice roll modifier format: {trait1: value between 1-5, trait2: 1-5, ...}",
    disadvantages: "Traits where CHARACTER has a low value and a negative dice roll modifier format: {trait1: value between -1 to -5, trait2: -1 to -5, ...}",
}

export async function generateCharacterStats(storyState, characterOverwrites) {
    let agent = "You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n" +
        "Always respond with following JSON!\n" +
        stringifyPretty(characterStateForPrompt);

    let preset = {
        ...storyState,
        ...characterOverwrites
    }

    const jsonText = await sendToAI({parts: [{"text": agent}]},
        {
            "role": "user",
            "parts": [{"text": "Create the character: " + stringifyPretty(preset)}]
        }
    );
    if (jsonText) {
        try{
            return JSON.parse(jsonText);
        }catch (e){
            handleError(e);
        }
    }
    return undefined;
}
