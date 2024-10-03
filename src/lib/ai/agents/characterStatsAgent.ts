import {stringifyPretty} from "$lib/util.svelte.ts";
import {buildAIContentsFormat, GeminiProvider} from "../llmProvider";
import {ActionDifficulty} from "../../../routes/game/gameLogic";

export const abilityFormat = '{"name": "", "effect": "Clearly state the effect caused. If causing damage include a notation like 2d6", "mp_cost": integer}'

export const characterStatsStateForPrompt = {
    resources: 'Starting maximum HP and MP in range 20 - 100, based on overall description of the character. Format: {"MAX_HP": startingHP, "MAX_MP": startingMP}',
    traits: 'list of the beginning traits of the character in following format: {"trait1": startingValue1, "trait2": startingValue2, ...}',
    expertise: 'Traits where CHARACTER has a high value and a positive dice roll modifier format: {"trait1": value between 1-5, "trait2": 1-5, ...}',
    disadvantages: 'Traits where CHARACTER has a low value and a negative dice roll modifier format: {"trait1": value between -1 to -5, "trait2": -1 to -5, ...}',
    spells_and_abilities: `Array of spells and abilities. List 2-4 actively usable spells and abilities. At last include a 'Standard Attack'. Format: [${abilityFormat}]`,
}

export const npcRank = [
    "Very Weak",
    "Weak",
    "Average",
    "Strong",
    "Boss",
    "Legendary"
]

export const npcStatsStateForPrompt = {
    class: "",
    rank: "Power ranking of the NPC. Can be one of " + npcRank.join('|'),
    spells_and_abilities: characterStatsStateForPrompt.spells_and_abilities
}

export class CharacterStatsAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async generateCharacterStats(storyState, characterState, statsOverwrites) {
        let agentInstruction = "You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n" +
            "Always respond with following JSON!\n" +
            stringifyPretty(characterStatsStateForPrompt);

        return await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Description of the story: " + stringifyPretty(storyState)}]
            },
                {
                    role: "user",
                    parts: [{"text": "Description of the character: " + stringifyPretty(characterState)}]
                },
                {
                    role: "user",
                    parts: [{"text": "Already existing stats to be reused: " + stringifyPretty(statsOverwrites)}]
                }],
            {parts: [{"text": agentInstruction}]}
        );
    }

    async generateNPCStats(storyState, historyMessages, npcsToGenerate, customSystemInstruction) {
        const latestHistoryTextOnly = historyMessages.map(m => m.content).join("\n");
        let agent = {
            parts: [
                {
                    "text": "You are RPG NPC stats agent, generating the stats for a NPC according to game system, adventure and story progression."
                },
                {
                    "text": "Description of the adventure: " + stringifyPretty(storyState)
                },
                {
                    "text": "Latest story progression:\n" + latestHistoryTextOnly
                },
                {
                    "text": `Most important instruction! You must always respond with following JSON format! 
                            {"uniqueNpcName": ${stringifyPretty(npcStatsStateForPrompt)}}`
                },
            ]
        }
        if (customSystemInstruction) {
            agent.parts.push({"text": customSystemInstruction});
        }
        const action = "Generate the following NPCs. You must reuse the names given: " + stringifyPretty(npcsToGenerate);
        return await this.llmProvider.sendToAI(buildAIContentsFormat(action, undefined), agent);
    }

    async generateSingleAbility(storyState, characterState, characterStats, ability) {
        let agentInstruction = "You are RPG character stats agent, generating a single new ability for a character according to game system, adventure and character description.\n" +
            "Important instruction! The new ability must be based on the following: " + stringifyPretty(ability) + "\n" +
            "Always respond with following JSON!\n" +
            abilityFormat;

        return await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Description of the story: " + stringifyPretty(storyState)}]
            },
                {
                    role: "user",
                    parts: [{"text": "Description of the character: " + stringifyPretty(characterState)}]
                },
                {
                    role: "user",
                    parts: [{"text": "Stats of the character: " + stringifyPretty(characterStats)}]
                },
                {
                    role: "user",
                    parts: [{"text": "Important instruction! The new ability must be based on the following: " + stringifyPretty(ability)}]
                }],
            {parts: [{"text": agentInstruction}]}
        );
    }

}
