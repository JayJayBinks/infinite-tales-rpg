import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

export type Ability = { name: string; effect: string; mp_cost: number; image_prompt: string };
export const abilityFormatForPrompt =
	'{"name": string, "effect": "Clearly state the effect caused. If causing damage include the dice notation like 1d6+2 or 2d4", "mp_cost": integer, "image_prompt": short prompt for an image ai that generates an RPG game icon}';

export type Resources = { MAX_HP: number; MAX_MP: number };

export type CharacterStats = {
	level: number;
	resources: Resources;
	traits: { [trait: string]: number };
	expertise: { [expertise: string]: number };
	disadvantages: { [disadvantage: string]: number };
	spells_and_abilities: Array<Ability>;
};
//need to stringify ourselves because JSON stringify would double escape the string JSON
const characterStatsStateForPrompt = `{
		"level": Number; Level of the character according to Description of the story and character,
    "resources": "Starting maximum HP and MP in range 20 - 100, based on overall description and level of the character. Format: {"MAX_HP": startingHP, "MAX_MP": startingMP}",
    "traits": "list of the beginning traits of the character in following format: {"trait1": startingValue1, "trait2": startingValue2, ...}",
    "expertise": "Traits where CHARACTER has a high value and a positive dice roll modifier format: {"trait1": value between 1-5, "trait2": 1-5, ...}",
    "disadvantages": "Traits where CHARACTER has a low value and a negative dice roll modifier format: {"trait1": value between -1 to -5, "trait2": -1 to -5, ...}",
    "spells_and_abilities": "Array of spells and abilities according to game system and level. List 2-4 actively usable spells and abilities. At last include a 'Standard Attack'. Format: [${abilityFormatForPrompt}]"
}`;

export type AiLevelUp = {
	character_name: string;
	level_up_explanation: string;
	trait: string;
	formerAbilityName?: string;
	ability: Ability;
	resources: Resources;
};
const levelUpPrompt = `{
		"level_up_explanation": "Explanation why exactly this trait and ability have been increased. If already existing ability changed explain the ability changes.",
		"trait": "trait name",
		"resources": {"resourceName": newValue, ...},
		"ability": Existing ability leveled up or new ability according to game system and level; Format: ${abilityFormatForPrompt}
		"formerAbilityName": "refers an already existing ability name that is changed, null if new ability is gained",
}`;

export const initialCharacterStatsState: CharacterStats = {
	level: 0,
	resources: { MAX_HP: 0, MAX_MP: 0 },
	traits: {},
	expertise: {},
	disadvantages: {},
	spells_and_abilities: []
};

export const npcRank = ['Very Weak', 'Weak', 'Average', 'Strong', 'Boss', 'Legendary'];

export type NPCState = { [uniqueNpcName: string]: NPCStats };
export type NPCStats = {
	resources?: { current_hp: number; current_mp: number };
	class: string;
	rank: string;
	level: number;
	spells_and_abilities: Array<Ability>;
};

export const npcStatsStateForPromptAsString = `{
    "class": string,
    "rank": "Power ranking of the NPC. Can be one of " + ${npcRank.join('|')},
    "level": number; scale the level to the rank and player character level,
    "spells_and_abilities": List 2 actively usable spells or abilities according to game system and level. The damage must be limited to only 1 dice, 1d6 or 1d8 etc. At last include a 'Standard Attack'. Format: [${abilityFormatForPrompt}]
}`;

export class CharacterStatsAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async generateCharacterStats(
		storyState: Story,
		characterState: CharacterDescription,
		statsOverwrites: Partial<CharacterStats> | undefined = undefined
	): Promise<CharacterStats> {
		const agentInstruction =
			'You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n' +
			'Scale the stats and abilities according to the level. A low level character has expertise of 1.\n' +
			'Always respond with following JSON!\n' +
			characterStatsStateForPrompt;

		if (!statsOverwrites?.level) {
			statsOverwrites = { ...statsOverwrites, level: 1 };
		}
		const request: LLMRequest = {
			userMessage:
				'Create the character according to the descriptions and already existing stats.\n Scale the stats and abilities according to the level.',
			historyMessages: [
				{
					role: 'user',
					content: 'Description of the story: ' + stringifyPretty(storyState)
				},
				{
					role: 'user',
					content: 'Description of the character: ' + stringifyPretty(characterState)
				}
			],
			systemInstruction: agentInstruction
		};
		if (statsOverwrites) {
			request.historyMessages?.push({
				role: 'user',
				content:
					'Already existing stats to be reused, if level is given you must reuse the same value: ' +
					stringifyPretty(statsOverwrites)
			});
		}
		console.log(request);
		return (await this.llm.generateReasoningContent(request))?.parsedObject as CharacterStats;
	}

	async levelUpCharacter(
		storyState: Story,
		historyMessages: LLMMessage[],
		characterState: CharacterDescription,
		characterStats: CharacterStats
	): Promise<AiLevelUp> {
		const latestHistoryTextOnly = historyMessages.map((m: LLMMessage) => m.content).join('\n');

		const agentInstruction = [
			'You are RPG character stats agent, leveling up a character according to game system, adventure and character description.\n' +
				'Name one existing trait to be increased. ' +
				'Also invent a new ability or increase one ability by one level granting an improved effect or more damage. Always describe the full ability effect.\n' +
				'In addition, all resources are to be meaningfully increased according to GAME rules',
			'Current character stats:\n' + stringifyPretty(characterStats),
			'The level up must be based on the story progression, in which area the player acted well:\n' +
				latestHistoryTextOnly,
			'Always respond with following JSON!\n' + levelUpPrompt
		];

		const request: LLMRequest = {
			userMessage: 'Character has leveled up to level: ' + (characterStats.level + 1),
			historyMessages: [
				{
					role: 'user',
					content: 'Description of the story: ' + stringifyPretty(storyState)
				},
				{
					role: 'user',
					content: 'Description of the character: ' + stringifyPretty(characterState)
				}
			],
			systemInstruction: agentInstruction
		};
		console.log(stringifyPretty(request));
		const aiLevelUp = (await this.llm.generateReasoningContent(request))?.parsedObject as AiLevelUp;
		aiLevelUp.character_name = characterState.name;
		return aiLevelUp;
	}

	async generateNPCStats(
		storyState: Story,
		historyMessages: LLMMessage[],
		npcsToGenerate: Array<string>,
		characterStats: CharacterStats,
		customSystemInstruction: string
	): Promise<NPCState> {
		const latestHistoryTextOnly = historyMessages.map((m: LLMMessage) => m.content).join('\n');
		const agent = [
			'You are RPG NPC stats agent, generating the stats for NPCs according to game system, adventure and story progression.',
			'Description of the adventure: ' + stringifyPretty(storyState),
			'Latest story progression:\n' + latestHistoryTextOnly,
			'Scale the stats and abilities according to the player character level: ' +
				characterStats.level +
				'\n',
			`Most important instruction! You must always respond with following JSON format! 
                            {"uniqueNpcName": ${npcStatsStateForPromptAsString}, ...}`
		];
		if (customSystemInstruction) {
			agent.push(customSystemInstruction);
		}
		const action =
			'Generate the following NPCs. You must reuse the names given: ' +
			stringifyPretty(npcsToGenerate);
		const request: LLMRequest = {
			userMessage: action,
			systemInstruction: agent
		};
		return (await this.llm.generateReasoningContent(request))?.parsedObject as NPCState;
	}

	async generateSingleAbility(
		storyState: Story,
		characterState: CharacterDescription,
		characterStats: CharacterStats,
		ability: Ability
	): Promise<Ability> {
		const agentInstruction =
			'You are RPG character stats agent, generating a single new ability for a character according to game system, adventure and character description.\n' +
			'Scale the ability according to the level\n' +
			'Important instruction! The new ability must be based on the following: ' +
			stringifyPretty(ability) +
			'\n' +
			'Always respond with following JSON!\n' +
			abilityFormatForPrompt;

		const request: LLMRequest = {
			userMessage:
				'Important! The new ability must be based on the following: ' + stringifyPretty(ability),
			historyMessages: [
				{
					role: 'user',
					content: 'Description of the story: ' + stringifyPretty(storyState)
				},
				{
					role: 'user',
					content: 'Description of the character: ' + stringifyPretty(characterState)
				},
				{
					role: 'user',
					content: 'Stats of the character: ' + stringifyPretty(characterStats)
				}
			],
			systemInstruction: agentInstruction
		};
		return (await this.llm.generateReasoningContent(request))?.parsedObject as Ability;
	}

	static getSpellImagePrompt(ability: Ability, storyImagePrompt: string): string {
		if (!ability) {
			return '';
		}
		return storyImagePrompt + ' RPG game icon ' + (ability.image_prompt || ability.name);
	}
}
