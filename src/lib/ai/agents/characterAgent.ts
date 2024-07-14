import {stringifyPretty} from "../../util.svelte";
import {sendToAI} from "../llm";
import {characterState} from "../../state/characterState.svelte";

export async function generateCharacterStats(storyState) {
    const characterStateForPrompt = {
        "Race": "",
        "Class": "",
        "Alignment": "",
        "Background": "",
        "Name": "",
        "Personality": "",
        "Motivation": "",
        "Appearance": "",
        "Traits": "list of the beginning traits of the character in following format: {trait1: startingValue1, trait2: startingValue2, ...}",
        "Abilities": "Abilities and spells of the character",
        "Expertise": "Traits where CHARACTER has a high value and a positive dice roll modifier format: {trait1: value between 1-5, trait2: 1-5, ...}",
        "Disadvantages": "Traits where CHARACTER has a low value and a negative dice roll modifier format: {trait1: value between -1 to -5, trait2: -1 to -5, ...}",
    }
    let agent = "You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n" +
        "Always respond with following JSON!\n" +
        stringifyPretty(characterStateForPrompt);

    let preset = {
        ...storyState,
    }

    const jsonText = await sendToAI({parts: [{"text": agent}]},
        {
            "role": "user",
            "parts": [{"text": "Create the character: " + stringifyPretty(preset)}]
        }
    );
    if (jsonText) {
        characterState.value = JSON.parse(jsonText);
    }
}
