import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';

export type CampaignChapterPlotPoint = {
	plotId: number;
	objective: string;
	location: string;
	description: string;
	important_NPCs: Array<string>;
	steps: Array<string>;
};

export type CampaignChapter = {
	chapterId: number;
	title: string;
	description: string;
	plot_points: Array<CampaignChapterPlotPoint>;
};
export type Campaign = {
	game: string;
	campaign_title: string;
	campaign_description: string;
	character_simple_description: string;
	chapters: Array<CampaignChapter>;
};

export const getNewChapterObject = (chapterId: number) => {
	return {
		chapterId: chapterId,
		title: '',
		description: '',
		objective: '',
		plot_points: []
	};
};

export const getNewPlotPointObject = (plotId) => {
	return {
		plotId: plotId,
		location: '',
		description: '',
		objective: '',
		important_NPCs:
			'Give a detailed description and character traits for NPCs that are important to this plot point',
		steps:
			'A specific step to reach the objective ensuring a gradual narrative with meaningful moments. Each step should represent a significant part of the process, giving the player the opportunity to make impactful choices.'
	};
};

const chaptersPrompt = `{
		"chapterId": number,
		"title": string,
		"description": string,
		"objective": string,
		"plot_points": [
			{
				"plotId": always start at 1 again for each new chapter,
				"location": string,
				"description": string,
				"objective": string,
				"important_NPCs": [
					"Give a detailed description and character traits for NPCs that are important to this plot point",
					...
				],
				"steps": [
					"A specific step to reach the objective ensuring a gradual narrative with meaningful moments. Each step should represent a significant part of the process, giving the player the opportunity to make impactful choices.",
					...
				]
			},
			...
		]
	}`;

const jsonPrompt = `{
	"game": "Pick Any Pen & Paper System e.g. Pathfinder, Call of Cthulhu, Star Wars, Fate Core, World of Darkness, GURPS, Mutants & Masterminds, Dungeons & Dragons",
	"campaign_title": string,
	"campaign_description": string,
	"character_simple_description": "Generate a random character fitting the game system and campaignDescription, only provide a simple description and not every detail",
	"chapters": [
		${chaptersPrompt},
		...
	]
}`;

export const initialCampaignState = {
	game: '',
	campaign_title: '',
	campaign_description: '',
	character_simple_description: '',
	chapters: []
};

const plotPointNumberPrompt = 'Each chapter with 2 - 4 plot points';
const mainAgent =
	'You are Pen & Paper campaign agent, crafting an epic, overarching campaign with chapters. Each chapter is an own adventure with an own climax and then fades gradually into the next chapter.\n' +
	'Design the Campaign to gradually increase the complexity of chapters as the players progress.\n' +
	'Include at least one major obstacle or antagonist in each chapter that ties into the overall campaign theme.\n' +
	'Include important events, locations, NPCs and encounters that can adapt based on player choices, like alliances, moral dilemmas, or major battles.';

export class CampaignAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async generateCampaign(
		overwrites = {},
		characterDescription: CharacterDescription | undefined = undefined
	): Promise<Campaign> {
		const agent =
			mainAgent +
			'\nProvide 3 - 6 chapters.\n' +
			plotPointNumberPrompt +
			'\nAlways respond with following JSON!\n' +
			jsonPrompt;

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

	async checkCampaignDeviations(
		nextAction: Action,
		plannedCampaign: Campaign,
		actionHistory: Array<LLMMessage>
	): Promise<any> {
		//careful as these are proxies, adding is fine
		const actionHistoryStoryOnly = actionHistory
			.filter((message) => message.role === 'model')
			.map((message) => ({ role: 'model', content: JSON.parse(message.content).story }));

		actionHistoryStoryOnly.push({ role: 'user', content: nextAction.text });
		const agent =
			'You are Pen & Paper campaign agent, crafting an epic, overarching campaign with chapters. Each chapter is an own adventure with an own climax and then fades gradually into the next chapter.\n' +
			'You will be given a plan for a campaign as plannedCampaign and how the actual campaign unfolded during the play session as actualCampaign.\n' +
			'Then you must decide if the actualCampaign has deviated too much from plannedCampaign and create a nudge that gently guides the character back to follow the chapter plot.\n' +
			'Do not micro manage every single plot point but only take care that the overall chapter and campaign stay on track.\n' +
			'Always respond with following JSON!\n' +
			`{
				"currentChapter": Identify the most relevant chapterId in plannedCampaign that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - chapterId: {chapterId}",
				"currentPlotPoint": Identify the most relevant plotId in plannedCampaign that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - plotId: {plotId}",
  			"nextPlotPoint": Identify the next plotId in plannedCampaign, must be greater than currentPlotPoint or null if there is no next plot point; Format: "Reasoning why story is currently at this plotId - plotId: {plotId}",
  			"deviationExplanation": is the currentChapter still on track; if not include reasons why the actualCampaign deviated from currentChapter,
				"deviation": integer 0 - 100 how much the actualCampaign deviated from currentChapter,
				"pacingExplanation": reasoning on how quickly the characters are proceeding through the currentChapter,
				"pacing": integer 0 - 100 value increases/decreases depending on how quickly the characters are proceeding through the currentChapter,
				#only include plotNudge object if deviation > 50, else null
				"plotNudge": {
					"nudgeExplanation": Explain why the characters are guided back to follow the currentChapter plot,
					"nudgeStory": Create an NPC or event that gently guides the character back to follow the currentChapter plot. It must fit to the last character action.
				}
			}`;

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

	async generateSingleChapter(
		campaignState: Campaign,
		characterState: CharacterDescription,
		chapterNumberToGenerate: number,
		chapter: CampaignChapter
	): Promise<CampaignChapter> {
		const agentInstruction =
			mainAgent +
			'\n' +
			plotPointNumberPrompt +
			'\nImportant instruction! The new chapter must be based on the following: ' +
			stringifyPretty(chapter) +
			'\nThe new chapter must fit within the other chapters, generate a chapter with chapterId: ' +
			chapterNumberToGenerate +
			'\n' +
			'Always respond with following JSON!\n' +
			chaptersPrompt;

		const request: LLMRequest = {
			userMessage:
				'Important! The new chapter must be based on the following: ' + stringifyPretty(chapter),
			historyMessages: [
				{
					role: 'user',
					content: 'Description of the campaign: ' + stringifyPretty(campaignState)
				}
			],
			systemInstruction: agentInstruction
		};
		if (characterState) {
			request.historyMessages?.push({
				role: 'user',
				content: 'Description of the character: ' + stringifyPretty(characterState)
			});
		}
		return (await this.llm.generateContent(request)) as CampaignChapter;
	}
}
