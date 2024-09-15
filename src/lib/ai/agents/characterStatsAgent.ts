import {stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider} from "../llmProvider";

export const abilityFormat = '{"name": "", "effect": "", "mp_cost": "integer"}'

export const characterStatsStateForPrompt = {
    resources: 'Starting maximum HP and MP in range 20 - 100, based on overall description of the character. Format: {"MAX_HP": startingHP, "MAX_MP": startingMP}',
    traits: 'list of the beginning traits of the character in following format: {"trait1": startingValue1, "trait2": startingValue2, ...}',
    expertise: 'Traits where CHARACTER has a high value and a positive dice roll modifier format: {"trait1": value between 1-5, "trait2": 1-5, ...}',
    disadvantages: 'Traits where CHARACTER has a low value and a negative dice roll modifier format: {"trait1": value between -1 to -5, "trait2": -1 to -5, ...}',
    spells_and_abilities: `Array of spells and abilities. List 2-4 actively usable spells and abilities. Format: [${abilityFormat}]`,
}

export const npcStatsStateForPrompt = {
    class: "",
    tier: "Power ranking of the NPC ranging from 1 very weak to 20 most powerful",
    resources: characterStatsStateForPrompt.resources,
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

    async generateNPCStats(storyState, storyProgression, npcList) {
        let agentInstruction = "You are RPG NPC stats agent, generating the stats for a NPC according to game system, adventure and story progression.\n" +
            "Always respond with following JSON!\n" +
            '{"uniqueNpcName": ' + stringifyPretty(npcStatsStateForPrompt) + ', ...}';

        return await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Description of the story: " + stringifyPretty(storyState)}]
            },
                {
                    role: "user",
                    parts: [{"text": "Story progression to derive the NPCs from: " + storyProgression}]
                },
                {
                    role: "user",
                    parts: [{"text": "Generate the following NPCs " + stringifyPretty(npcList)}]
                }],
            {parts: [{"text": agentInstruction}]}
        );
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
