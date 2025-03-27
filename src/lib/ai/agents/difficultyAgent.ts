import { stringifyPretty } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import { diceRollPrompt } from './actionAgent';

export type DiceRollDifficulty = {
	action_difficulty?: ActionDifficulty;
	dice_roll?: {
		modifier: 'none' | 'bonus' | 'malus';
		modifier_value: number;
		modifier_explanation: string;
	};
};

export class DifficultyAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	//TODO remove and replace with actionAgent
	async generateDifficulty(
		actionText: string,
		customSystemInstruction: string,
		historyMessages: Array<LLMMessage>,
		characterState: CharacterDescription,
		characterStats: CharacterStats,
		relatedActionHistory: string[]
	): Promise<DiceRollDifficulty> {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['spells_and_abilities']: _, ...characterStatsStateMapped } = characterStats;
		const agent = [
			'You are RPG difficulty agent, the player character will try to perform an action ' +
				'and you determine how difficult it is in the current situation, considering the story, action effect, number of targets and character description. ' +
				' The difficulty increases with more targets. If player character is in combat apply a bonus to dice_roll' +
				' Any action is allowed to target anything per game rules.',
			'The following is a description of the player character' +
				'\n' +
				stringifyPretty(characterState),
			"The following are the player character's stats " +
				'\n' +
				stringifyPretty(characterStatsStateMapped),
			`Most important instruction! You must always respond with following JSON format! 
               {
                   "difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
                   "action_difficulty": "${Object.keys(ActionDifficulty)}",
                   ${diceRollPrompt}
                }`
		];
		if (customSystemInstruction) {
			agent.push(customSystemInstruction);
		}
		let userMessage = actionText;
		if (relatedActionHistory.length > 0) {
			userMessage +=
				'\nFollowing are related past story plot, check if the action is possible in this context, it must be plausible in this moment and not just hypothetically:\n' +
				relatedActionHistory.join('\n');
		}
		const request: LLMRequest = {
			userMessage: userMessage,
			historyMessages: historyMessages,
			systemInstruction: agent,
			temperature: this.llm.getDefaultTemperature()
		};
		return (await this.llm.generateContent(request)) as DiceRollDifficulty;
	}
}
