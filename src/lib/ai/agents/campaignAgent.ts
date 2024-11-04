import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { Action } from '$lib/ai/agents/gameAgent';

export type CampaignChapterPlotPoint = {
	plotId: number;
	objective: string;
	location: string;
};

export type CampaignChapter = {
	chapterId: number;
	title: string;
	description: string;
	plotPoints: Array<CampaignChapterPlotPoint>;
};
export type Campaign = {
	campaignTitle: string;
	campaignDescription: string;
	chapters: Array<CampaignChapter>;
};

//TODO for triggers we would need to ask AI after ever action right?
// #outcomes can be positive or negative, depending on the trigger
// "outcomes": [{
// 	"trigger": "Condition to trigger this outcome",
// 	"result": "Outcome result"
// },
// 	...
// ]

const chaptersPrompt = `{
		"chapterId": number,
		"title": string,
		"description": string,
		"objective": string,
		"completenessTrigger": trigger description when this chapter is considered successfull and failed,
		"plotPoints": [
			{
				"plotId": number,
				"location": string,
				"description": string,
				"objective": string,
			},
			...
		]
	}`;

const jsonPrompt = `{
	"game": "Pick Any Pen & Paper System e.g. Pathfinder, Call of Cthulhu, Star Wars, Fate Core, World of Darkness, GURPS, Mutants & Masterminds, Dungeons & Dragons",
	"campaignTitle": string,
	"campaignDescription": string,
	"chapters": [
		${chaptersPrompt},
		...
	]
}`;

export const initialCampaignState = {
	game: '',
	campaignTitle: '',
	campaignDescription: '',
	chapters: []
};

const mainAgent =
	'You are Pen & Paper campaign agent, crafting an epic, overarching campaign with chapters. Each chapter is an own adventure with an own climax and then fades gradually into the next chapter.\n' +
	'Design the Campaign to gradually increase the complexity of chapters as the players progress.\n' +
	'Include at least one major obstacle or antagonist in each chapter that ties into the overall campaign theme.\n' +
	'Include important events, locations, or encounters that can adapt based on player choices, like alliances, moral dilemmas, or major battles..\n' +
	'Each chapter must include secrets for the characters to discover on how to get to the next chapter.\n';

export class CampaignAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async generateCampaign(overwrites = {}, characterDescription = undefined): Promise<Campaign> {
		const agent = mainAgent + 'Always respond with following JSON!\n' + jsonPrompt;

		const preset = {
			...overwrites
		};
		const request: LLMRequest = {
			userMessage:
				'Create a new randomized campaign considering the following settings: ' +
				stringifyPretty(preset),
			historyMessages: [],
			systemInstruction: agent,
			temperature: 1
		};
		if (characterDescription) {
			request.historyMessages?.push({
				role: 'user',
				content: 'Character description: ' + stringifyPretty(characterDescription)
			});
		}
		return (await this.llm.generateContent(request)) as Campaign;
	}

	'If actionHistory has deviated too much from currentCampaign, return the adjusted campaign chapters to fit again to the character actions.\n';
	'If you determine that the currentCampaign needs to be adjusted, make sure the adjusted chapters adhere to campaignDescription.\n';
	'Then you must decide if the current and upcoming campaign chapters need to be adjusted to fit to the character actions again.\n';
	savedForLater = `,
	#only include adjustedChapters object if deviation > 80, else null
	"adjustedChapters": {
		"adjustedChaptersExplanation": Explain why the chapters where adjusted,
		"chapters": [
			${chaptersPrompt},
...
]
}`;

	async adjustCampaignToCharacterActions(
		nextAction: Action,
		currentCampaign: Campaign,
		actionHistory: Array<LLMMessage>
	): Promise<any> {
		//carefu as these are proxies, adding is fine
		const actionHistoryCopy = [...actionHistory];
		actionHistoryCopy.push({ role: 'user', content: nextAction.text });
		const agent =
			mainAgent +
			'You will be given an existing campaign and the past character actions as actionHistory.\n' +
			'Then you must decide if the actionHistory has deviated too much from currentCampaign and create a nudge that gently guides the character back to follow the chapter plot.\n' +
			'Do not micro manage every single plot point but only take care that the overall chapter and campaign stay on track.\n' +
			'Always respond with following JSON!\n' +
			`{
				"chapterReferenceExplanation": "short reasoning why the story is currently at chapterReference",
				"chapterReference": chapterId that the story is currently developed at according to actionHistory,
				"plotPointReferenceExplanation": "short reasoning why the story is currently at plotPointReference",
				"plotPointReference": plotId that the story is currently developed at according to actionHistory,
				"waitingForEventTrigger": "the eventTrigger that is waited to be triggered for chapterReference",
				"eventTriggered": true if the eventTrigger from chapterReference is triggered,
				"deviationExplanation": string,
				"deviation": integer 0 - 100 how much the characterActions deviated from currentCampaign,
				#only include plotNudge object if deviation > 50, else null
				"plotNudge": {
					"nudgeExplanation": Explain why the characters are guided back to follow the chapter plot,
					"nudgeStory": Create an NPC or event that gently guides the character back to follow the chapter plot. It must fit to the last character action.
				}
			}`;

		//TODO
		const saved =
			'If you determine that the currentCampaign needs to be adjusted, make sure the adjusted chapters adhere to campaignDescription.\n';
		const request: LLMRequest = {
			userMessage: 'Check if the actionHistory is on course with the currentCampaign.',
			historyMessages: [
				{
					role: 'user',
					content: 'currentCampaign: ' + stringifyPretty(currentCampaign)
				},
				{
					role: 'user',
					content: 'actionHistory: ' + stringifyPretty(actionHistoryCopy)
				}
			],
			systemInstruction: agent
		};
		return (await this.llm.generateContent(request)) as Campaign;
	}
}
