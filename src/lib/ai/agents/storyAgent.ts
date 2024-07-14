import {storyState, storyStateForPrompt} from "../../state/storyState.svelte";
import {handleError, stringifyPretty} from "../../util.svelte";
import {sendToAI} from "../llm";
import {generateCharacterStats} from "./characterAgent";

export async function generateRandomStorySettings() {
    let storyAgent = "You are RPG story agent, crafting captivating, limitless GAME experiences using BOOKS, THEME, TONALITY for CHARACTER.\n" +
        "Always respond with following JSON!\n" +
        stringifyPretty(storyStateForPrompt);

    let preset = {
        ...storyStateForPrompt,
        ...storyState.overwrites,
    }
    const jsonText = await sendToAI({parts: [{"text": storyAgent}]},
        {
            "role": "user",
            "parts": [{"text": "Create a new randomized story setting with following already set: " + stringifyPretty(preset)}]
        }
    );
    try {


        if (jsonText) {
            let newStoryState = JSON.parse(jsonText);
            storyState.value = newStoryState;

            await generateCharacterStats(storyState)
        }
    } catch (e) {
        handleError(e);
    }
}