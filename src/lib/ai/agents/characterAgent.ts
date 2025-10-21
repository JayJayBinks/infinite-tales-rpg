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

// Party types
export type PartyMember = {
	id: string;
	character: CharacterDescription;
};

export type Party = {
	members: PartyMember[];
	activeCharacterId: string;
};

export const initialPartyState: Party = {
	members: [],
	activeCharacterId: ''
};

const partyDescriptionForPrompt = `[
	${characterDescriptionForPrompt},
	${characterDescriptionForPrompt},
	${characterDescriptionForPrompt},
	${characterDescriptionForPrompt}
]`;

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

	async generatePartyDescriptions(
		storyState: object,
		partyOverwrites?: Partial<CharacterDescription>[]
	): Promise<CharacterDescription[]> {
		const agentInstruction = [
			'You are RPG character agent, creating a party of 4 diverse characters for an RPG adventure.\n' +
				'Create 4 unique characters that complement each other with different classes, races, and personalities.\n' +
				'Ensure the party has a good balance of combat, magic, support, and social skills.\n' +
				TROPES_CLICHE_PROMPT
		];
		agentInstruction.push(jsonRule + '\n' + partyDescriptionForPrompt);

		const preset = partyOverwrites || [{}, {}, {}, {}];
		const request: LLMRequest = {
			userMessage:
				'Create a party of 4 characters for this adventure:\n' +
				stringifyPretty(storyState) +
				'\n\nParty overwrites (if any):\n' +
				stringifyPretty(preset),
			systemInstruction: agentInstruction
		};
		return (await this.llm.generateContent(request))?.content as CharacterDescription[];
	}
}
