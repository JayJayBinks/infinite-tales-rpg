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
		"plotPoints": [
			{
				"plotId": always start at 1 again for each new chapter,
				"location": string,
				"description": string,
				"objective": string,
				"obstacles": [
					"One specific obstacle including detailed description e.g. a negotiation; a puzzle; an enemy; ...",
					...
				]
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
		const campaign = (await this.llm.generateContent(request)) as Campaign;
		return campaign;
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
		plannedCampaign: Campaign,
		actionHistory: Array<LLMMessage>
	): Promise<any> {
		//carefu as these are proxies, adding is fine
		const actionHistoryStoryOnly = actionHistory.filter(message => message.role === 'model')
			.map(message => ({ role: 'model', content: JSON.parse(message.content).story }));

		actionHistoryStoryOnly.push({ role: 'user', content: nextAction.text });
		const agent =
			mainAgent +
			'You will be given a plan for a campaign as plannedCampaign and how the actual campaign unfolded during the play session as actualCampaign.\n' +
			'Then you must decide if the actualCampaign has deviated too much from plannedCampaign and create a nudge that gently guides the character back to follow the chapter plot.\n' +
			'Do not micro manage every single plot point but only take care that the overall chapter and campaign stay on track.\n' +
			'Always respond with following JSON!\n' +
			`{
				"currentChapter": Identify the most relevant chapterId in plannedCampaign that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - chapterId: {chapterId}",
				"currentPlotPoint": Identify the most relevant plotId in plannedCampaign that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - plotId: {plotId}",
  			"nextPlotPoint": Identify the next plotId in plannedCampaign, must be greater than currentPlotPoint or null if there is no next plot point; Format: "Reasoning why story is currently at this plotId - plotId: {plotId}",
  			"deviationExplanation": why the actualCampaign deviated from currentPlotPoint,
				"deviation": integer 0 - 100 how much the actualCampaign deviated from currentChapter,
				#only include plotNudge object if deviation > 50, else null
				"plotNudge": {
					"nudgeExplanation": Explain why the characters are guided back to follow the currentChapter plot,
					"nudgeStory": Create an NPC or event that gently guides the character back to follow the currentChapter plot. It must fit to the last character action.
				}
			}`;

		//TODO
		const saved =
			'If you determine that the plannedCampaign needs to be adjusted, make sure the adjusted chapters adhere to campaignDescription.\n';
		const request: LLMRequest = {
			userMessage: 'Check if the actualCampaign is on course with the plannedCampaign.',
			historyMessages: [
				{
					role: 'user',
					content: 'plannedCampaign: ' + stringifyPretty(plannedCampaign)
				},
				{
					role: 'user',
					content: 'actualCampaign: ' + stringifyPretty(actionHistoryStoryOnly)
				}
			],
			systemInstruction: agent
		};
		return (await this.llm.generateContent(request)) as Campaign;
	}
}
