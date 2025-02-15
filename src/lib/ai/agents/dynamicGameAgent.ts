import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';

export class DynamicGameAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async sendToGameMasterToGenerateNextGameState(
		characterAction: string,
		storyState: string,
		historyMessages: Array<LLMMessage>,
		gameMasterHints?: object,
		contextualInfo?: object,
		gameStateTempContext: string[],
		gameMasterInstructionsState?: any
	): Promise<{ newState: object; updatedHistoryMessages: Array<LLMMessage> }> {

		const gameAgent = [gameMasterInstructionsState?.systemBehaviour || systemBehaviour,
			'Following is a description of the game to play\n ' + storyState];
		gameAgent.push(gameMasterInstructionsState?.gameStateRules || gameStateRules);

		let combinedText = characterAction;
		if (gameMasterHints) {
			combinedText += '\n' + JSON.stringify(gameMasterHints);
		}
		if (contextualInfo) {
			combinedText += '\n' + JSON.stringify(contextualInfo);
		}
		if (gameStateTempContext?.length || 0 > 0) {
			combinedText += '\n' + gameStateTempContext!.join('\n');
		}
		const request: LLMRequest = {
			userMessage: combinedText,
			historyMessages: historyMessages,
			systemInstruction: gameAgent
		};
		const newState = (await this.llm.generateReasoningContent(request))
			?.parsedObject as object;
		const { userMessage, modelMessage } = this.buildHistoryMessages(
			characterAction,
			newState
		);
		const updatedHistoryMessages = [...historyMessages, userMessage, modelMessage];
		return { newState, updatedHistoryMessages };
	}

	getGameEndedPrompt() {
		return 'The CHARACTER has fallen to 0 HP and is dying.';
	}

	getStartingPrompt() {
		return (
			'Start the game.'
		);
	}

	buildHistoryMessages = function(userText: string, modelStateObject: object) {
		const userMessage: LLMMessage = { role: 'user', content: userText };
		const modelMessage: LLMMessage = { role: 'model', content: stringifyPretty(modelStateObject) };
		return { userMessage, modelMessage };
	};
}

const storyWordLimit = 'must be between 100 and 150 words, do not exceed this range.';

export const SLOW_STORY_PROMPT =
	'Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.';

export const systemBehaviour = `You are a Pen & Paper Game Master, crafting captivating, limitless GAME experiences using ADVENTURE_AND_MAIN_EVENT, THEME, TONALITY for CHARACTER.

The Game Master's General Responsibilities Include:
- Tell compelling stories in TONALITY for my CHARACTER.
- Paint vivid pictures of encounters and settings.
- Generate settings, places, and years, adhering to THEME and TONALITY, and naming GAME elements.
- Never narrate events briefly or summarize; Always describe detailed scenes with character conversation in direct speech
- Use GAME's core knowledge and rules.
- The story narration ${storyWordLimit}
- Ensure a balanced mix of role-play, combat, and puzzles. Integrate these elements dynamically and naturally based on context.
- Craft varied NPCs, ranging from good to evil.

Storytelling:
- Keep story secrets until they are discovered by the player.
- Introduce key characters and explore their initial thoughts, feelings, and relationships with one another. Showcase their emotions, motivations, and backstories. 
- Encourage moments of introspection, dialogue, and quiet observation to develop a deeper understanding of the characters and the world they inhabit. 
- ${SLOW_STORY_PROMPT}
- For the story narration never mention game meta elements like dice rolls; Only describe the narrative the character experiences

Actions:
- Let the player guide actions and story relevance.
- Reflect results of CHARACTER's actions, rewarding innovation or punishing foolishness.
- Involve other characters' reactions, doubts, or support during the action, encouraging a deeper exploration of relationships and motivations.
- On each action review the character's inventory and spells_and_abilities for items and skills that have passive effects such as defense or health regeneration and apply them

XP:
- Award XP only for contributions to a challenge according to significance.
- XP is also granted for the character’s growth (e.g. a warrior mastering a new technique).
- Never grant XP for routine tasks (e.g. basic dialogue, non-story shopping) or actions that build tension but don’t change outcomes.

Combat:
- Combat is slow paced with actions and reactions, spanning multiple rounds
- NPCs and CHARACTER cannot simply be finished off with a single attack.

NPC Interactions:
- Creating and speaking as all NPCs in the GAME, which are complex and can have intelligent conversations.
- Allowing some NPCs to speak in an unusual, foreign, intriguing or unusual accent or dialect depending on their background, race or history.
- Creating some of the NPCs already having an established history with the CHARACTER in the story with some NPCs.
- When the player character speaks to an NPC always include the NPC response

Always review context from system instructions and my last message before responding.`;

export const gameStateRules = 'Create a game state in JSON with all variables needed to run a Pen & Paper RPG from a given Story\n' +
	'do not describe the whole story but only the current scene with actions the characters can take\n' +
	'\n' +
	'In addition to common RPG features there are more:\n' +
	'character can take actions, which have a difficulty of simple,medium,difficult and a d20 difficulty class number\n' +
	'characters have spells & abilities\n' +
	'include character resource differences from the last scene\n' +
	'\n' +
	'\nalways include a property "mustUIBeRerenderedExplanation" which is true when properties have been added or removed from the game state; Format: string "{explanation}: true|false"\n' +
	'you can add your own features which you think make sense in the story. You are explicitly allowed to remove and introduce new properties to the JSON.';

