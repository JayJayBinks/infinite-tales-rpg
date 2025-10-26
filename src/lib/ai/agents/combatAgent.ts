import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type {
	Action,
	InventoryState,
	NPCAction,
	PlayerCharactersGameState,
	ResourcesWithCurrentValue
} from '$lib/ai/agents/gameAgent';
import { mapStatsUpdates } from '$lib/ai/agents/mappers';
import { ActionDifficulty, getEmptyCriticalResourceKeys } from '../../../routes/game/gameLogic';
import type { Story } from '$lib/ai/agents/storyAgent';
import { jsonRule } from './agentUtils';
import { GEMINI_MODELS, THINKING_BUDGET } from '../geminiProvider';

export type DiceRoll = {
	result;
	number?: number;
	type?: number;
	modifier?: number;
	rolls?: number[];
};
export type StatsUpdate = {
	sourceName?: string;
	targetName: string;
	value: DiceRoll;
	type: string;
};
export const statsUpdatePromptObject = `
	"stats_update": [
		# You must include one update for each ACTIVE action
		# Also include one update per ongoing turn effect like poisoned or bleeding
		{
		"explanation": "Short explanation for the reason of this change",
		# If targetName is an NPC then resourceKey must be one of hp, mp; if a party member then one of that party member's resources
			"sourceName": "NPC name or PARTY MEMBER name who is the initiator of this action",
			"targetName": "NPC name or PARTY MEMBER name whose stats must be updated.",
			"type": "{resourceKey}_lost|{resourceKey}_gained; resourceKey must be one of the targetName's resources",
			"value": "must be dice roll notation in format 1d6+3 or 3d4 etc."
		},
		{
			"targetName": "Party member name who gains XP.",
			"explanation": "Short explanation for the reason of this change",
		   	"type": "xp_gained",
		   	"value": "SMALL|MEDIUM|HIGH"
		},
		...
		]`;

export class CombatAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	/**
	 * Generates ONLY stats_update (including xp_gained) after the story narration has been produced.
	 * Inventory is intentionally excluded (still handled in GameAgent story generation).
	 */
	async generateStatsUpdatesFromStory(
		story: string,
		playerAction: Action,
		partyMemberResources: { [partyMemberName: string]: ResourcesWithCurrentValue },
		presentNPCKnownNames: string[],
		customSystemInstruction: string,
		customCombatAgentInstruction: string
	): Promise<StatsUpdate[]> {
		const npcNames = presentNPCKnownNames.slice(-50);

		const systemInstruction: string[] = [];
		// Role description (party-aware)
		systemInstruction.push(
			'You are Stats Update Agent. Tasks: (1) Determine which ACTIVE ACTIONS party members and NPCs take from the STORY; (2) Derive precise stats_update entries from ONLY those actions or ongoing status effects. Never invent events not explicitly described.'
		);
		// Provide resource context (party members)
		const partyMemberNames = Object.keys(partyMemberResources);
		const perMemberResourceLines = partyMemberNames.map((name) => {
			const resourceKeys = Object.keys(partyMemberResources[name] || {}).filter(
				(k) => k.toLowerCase() !== 'xp'
			);
			return `${name}: ${resourceKeys.join(', ') || 'NO_RESOURCES_DEFINED'}`;
		});
		systemInstruction.push(
				`Party member names and resource keys (only use the listed keys for the matching member, never mix them across members):\n` +
				perMemberResourceLines.join('\n') +
				`\nAction resource costs (if any) are explicitly listed; do NOT infer or double-apply costs.`
		);
		systemInstruction.push(
			'NPC names you may reference EXACTLY (hp/mp only):\n' + npcNames.join(', ')
		);
		// Reuse original stats update spec
		systemInstruction.push(
			`${jsonRule}\n{\n"determined_actions": "string array; one entry per ACTIVE action only (no outcomes/effects)", ${statsUpdatePromptObject}\n}\n` +
				'# Rules (Party-Oriented):\n' +
				`ACTIONS:
			- Strict Adherence: Derive actions ONLY from events explicitly stated in STORY.
			- List ONLY the initiating action (e.g. 'A strikes B'), NOT outcomes ('B is wounded').
			- Confirmed Hits Only: Produce hp_lost (or other resource lost) ONLY when impact / harm is explicit.
			- Ongoing effects (bleeding, poison, burning) each produce their own update per tick if explicitly described.
			Party members are NOT NPCs; never classify them as such.
			` +
				`STATS_UPDATE:
			- One entry per ACTIVE action that causes a resource change, plus explicit ongoing effects.
			- Use dice notation (e.g. 1d6+2) for non-xp values unless an exact numeric or cost is specified.
			- If COST OF THE PLAYER ACTION is provided, reflect that cost exactly once; do not fabricate extra cost.
			- Types: {resourceKey}_lost | {resourceKey}_gained | xp_gained.
			- Handle PARTY MEMBER resources per game rules (e.g. survival drains, blood magic self-costs) ONLY if explicitly narrated.
			` +
				`XP:
			- Award to the specific contributing party member(s) only.
			- SMALL: reconnaissance / minor progress.
			- MEDIUM: meaningful step toward major goal.
			- HIGH: decisive breakthrough / resolution.
			- No XP for trivial, routine, or purely atmospheric actions.
			`
		);
		if (customSystemInstruction) {
			systemInstruction.push(
				'Additional instructions which can override others: ' + customSystemInstruction
			);
		}
		if (customCombatAgentInstruction) {
			systemInstruction.push(
				'Additional instructions which can override others: ' + customCombatAgentInstruction
			);
		}

		const userMessage =
			'STORY (reference only, do NOT repeat):\n' +
			story +
			(playerAction.resource_cost
				? '\n\nCOST OF THE PLAYER ACTION:\n' + JSON.stringify(playerAction.resource_cost)
				: '') +
			'\n\nReturn ONLY JSON with determined_actions and stats_update.';

		const request: LLMRequest = {
			userMessage,
			historyMessages: [],
			systemInstruction,
			returnFallbackProperty: true,
			reportErrorToUser: false,
			temperature: 0.7,
			model: GEMINI_MODELS.FLASH_2_5,
			thinkingConfig: { includeThoughts: true }
		};
		const response = await this.llm.generateContent(request);
		console.log('stats updates thoughts: ', response?.thoughts);
		// Expect either {stats_update: [...]} or just [...]
		let stats_update: StatsUpdate[] = [];
		const content: any = response?.content;
		if (Array.isArray(content)) {
			stats_update = content as StatsUpdate[];
		} else if (content?.stats_update && Array.isArray(content.stats_update)) {
			stats_update = content.stats_update as StatsUpdate[];
		}
		console.log('stats updates raw: ', stringifyPretty(content));
		// Map dice notations
		const updates = { stats_update };
		mapStatsUpdates(updates);
		return updates.stats_update || [];
	}

	//TODO are effects like stunned etc. considered via historyMessages?
	//TODO far future improvement, include initiative with chain of actions, some actions then are skipped due to stun, death etc.
	async generateActionsFromContext(
		action: Action,
		inventoryState: InventoryState,
		npcsList: Array<object>,
		customSystemInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story
	): Promise<NPCAction[]> {
		if( npcsList.length === 0){
			return [];
		}
		const agent = [
			"You are RPG combat agent, you decide which actions the NPCs take in response to the active party member's action and the outcomes of these actions. Remember that other party members may also be present." +
				'\n For deciding the outcome simulate if the NPC action can be successfull based on the circumstances.' +
				'\n You must include an action for each NPC from the list.',
			"The party's shared inventory - if an item is relevant in combat then apply its effect:" +
				'\n' +
				stringifyPretty(inventoryState),
			'The following is a description of the story setting to keep the actions consistent on.' +
				'\n' +
				stringifyPretty(storyState),
			`${jsonRule}
                 [
                    # You must include one object for each npc
                    {
                      "sourceId": "NPC id",
                      "targetId": "NPC id or player character name, whose stats must be updated. if sourceId targets self then same as sourceId",
					  "actionOnly": "only description of the action the NPC takes",
					  "simulated_outcome": "short description of the simulated outcome (success or failure) of the action"
                    },
                    ...
                ]`
		];
		if (customSystemInstruction) {
			agent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customCombatAgentInstruction) {
			agent.push('Following instructions overrule all others: ' + customCombatAgentInstruction);
		}
		const actionToSend =
			'The active party member named ' +
			action.characterName +
			' takes following action: ' +
			action.text +
			'\n' +
			'Decide the action for each of the following NPCs. It can be a spell, ability or any other action. Important: You must reuse the exact nameIds that are given!' +
			'\n' +
			stringifyPretty(npcsList);
		console.log('combat', actionToSend);
		const request: LLMRequest = {
			userMessage: actionToSend,
			historyMessages: historyMessages,
			systemInstruction: agent,
			reportErrorToUser: false,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: {
				thinkingBudget: THINKING_BUDGET.DEFAULT
			}
		};

		const state = (await this.llm.generateContent(request))?.content as Array<NPCAction>;
		return state;
	}

	static getAdditionalStoryInput(actions: Array<NPCAction>, deadNPCs?: Array<string>) {
		// let bossFightPrompt = allNpcsDetailsAsList.some(npc => npc.rank === 'Boss' || npc.rank === 'Legendary')
		//     ? '\nFor now only use following difficulties: ' + bossDifficulties.join('|'): ''
		if (deadNPCs && deadNPCs.length > 0) {
			actions = actions.filter(
				(action) => !deadNPCs.includes(action.sourceId) && !deadNPCs.includes(action.targetId)
			);
		}
		const mappedActions = actions.map(
			(action) =>
				`${action.sourceId} targets ${action.targetId} with result: ${action.simulated_outcome}`
		);
		return mappedActions.length === 0
			? ''
			: '\nDescribe the player action and the following NPCS actions in the story progression:\n' +
					stringifyPretty(mappedActions) +
					'\n';
	}

	static getNPCsHealthStatePrompt(
		deadNPCs: Array<string>,
		aliveNPCs?: Array<string>,
		playerCharactersGameState?: PlayerCharactersGameState
	) {
		let text = '';
		if (aliveNPCs && aliveNPCs.length > 0) {
			text +=
				'\n ' +
				'Following NPCs are still alive after the attacks!' +
				'\n' +
				stringifyPretty(aliveNPCs);
		}
		if (deadNPCs && deadNPCs.length > 0) {
			text +=
				'\n ' +
				'Following NPCs have died, describe their death in the story progression.' +
				'\n' +
				stringifyPretty(deadNPCs) +
				'\n';
		}
		if (playerCharactersGameState) {
			const aliveChars = Object.keys(playerCharactersGameState).filter(
				(playerName) =>
					getEmptyCriticalResourceKeys(playerCharactersGameState[playerName]).length === 0
			);
			text += '\n Player Characters ' + aliveChars.join(', ') + ' are alive after the attacks!';
		}

		return text;
	}

	static getCombatPromptAddition() {
		//TODO rather do this programatically?
		const combatDifficulties = [
			ActionDifficulty.simple,
			ActionDifficulty.medium,
			ActionDifficulty.difficult
		];
		return (
			'\nOnly suggest combat actions given the situation' +
			'\nOnly use following difficulties: ' +
			combatDifficulties.join('|') +
			'\nOnly apply bonus to dice_roll'
		);
	}
}
