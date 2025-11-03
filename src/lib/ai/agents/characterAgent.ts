import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import { TROPES_CLICHE_PROMPT } from '$lib/ai/agents/storyAgent';
import { jsonRule } from './agentUtils';

export type CharacterDescription = {
	name: string;
	class: string;
	race: string;
	gender: string;
	appearance: string;
	alignment: string;
	personality: string;
	background: string;
	motivation: string;
};

const characterDescriptionForPrompt = `{
    "name": string,
    "class": string,
    "race": string,
    "gender": string,
    "appearance": string,
    "alignment": string,
    "personality": string,
    "background": string,
    "motivation": string
}`;

export const initialCharacterState: CharacterDescription = {
	name: '',
	class: '',
	race: '',
	gender: '',
	appearance: '',
	alignment: '',
	personality: '',
	background: '',
	motivation: ''
};

export class CharacterAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async generateCharacterDescription(
		storyState: object,
		characterOverwrites: Partial<CharacterDescription> | undefined = undefined,
		transformInto?: string
	): Promise<CharacterDescription> {
		const agentInstruction = [
			'You are RPG character agent, describing a single character according to game system, adventure and character description.\n' +
				TROPES_CLICHE_PROMPT
		];
		if (transformInto) {
			agentInstruction.push(
				'Determine if following transformation completely changes or just adapts the character; ' +
					'Describe how the character changed based on already existing values;\nTransform into:\n' +
					transformInto
			);
		}
		agentInstruction.push(jsonRule + '\n' + characterDescriptionForPrompt);

		const preset = {
			...storyState,
			...characterOverwrites
		};
		const request: LLMRequest = {
			userMessage: 'Create the character: ' + stringifyPretty(preset),
			systemInstruction: agentInstruction
		};
		return (await this.llm.generateContent(request))?.content as CharacterDescription;
	}

	async generatePartyCharacterDescriptions(
		storyState: object,
		partySize: number,
		overwrites: Array<Partial<CharacterDescription> | undefined> = [],
		transformations: Array<string | undefined> = []
	): Promise<CharacterDescription[]> {
		if (partySize <= 0) return [];
		const generatedMembers: CharacterDescription[] = [];
		for (let index = 0; index < partySize; index += 1) {
			const memberOverrides = overwrites[index];
			const transformInto = transformations[index];
			const description = await this.generateCharacterDescription(
				storyState,
				memberOverrides,
				transformInto
			);
			if (description) {
				generatedMembers.push(description);
			}
		}
		return generatedMembers;
	}

	async generatePartyCharacterDescriptionsBatch(
		storyState: object,
		partySize: number,
		overwrites: Array<Partial<CharacterDescription> | undefined> = [],
		transformations: Array<string | undefined> = []
	): Promise<CharacterDescription[]> {
		if (partySize <= 0) return [];

		const partyPrompt = Array.from({ length: partySize }, (_, index) => {
			const memberOverrides = overwrites[index];
			const transformInto = transformations[index];
			let memberPrompt = `Party Member ${index + 1}:\n`;
			if (memberOverrides && Object.keys(memberOverrides).length > 0) {
				memberPrompt += `Use existing fields as fixed values. EXISTING FIELDS:\n${stringifyPretty(memberOverrides)}\n`;
			}
			if (transformInto) {
				memberPrompt += `Transform into: ${transformInto}\n`;
			}
			return memberPrompt;
		}).join('\n---\n');

		const agentInstruction = [
			'You are RPG character agent, describing a party of adventurers according to the game system, adventure and provided details.\n' +
				'Each member must feel distinct and contribute unique strengths to the party.\n' +
				TROPES_CLICHE_PROMPT,
			`${jsonRule}\nReturn an array of character descriptions, one for each party member in order:\n[${characterDescriptionForPrompt}, ${characterDescriptionForPrompt}, ...]`
		];

		const request: LLMRequest = {
			userMessage:
				'Create the party members for the given story. Reuse existing fields exactly as provided and fill in the missing ones.\n' +
				partyPrompt,
			systemInstruction: agentInstruction,
			historyMessages: [
				{
					role: 'user',
					content: 'Description of the story: ' + stringifyPretty(storyState)
				}
			]
		};

		const response = await this.llm.generateContent(request);
		const descriptions = response?.content as CharacterDescription[];
		if (!Array.isArray(descriptions)) {
			console.error('Expected array of character descriptions, got:', descriptions);
			return [];
		}
		return descriptions;
	}
}
