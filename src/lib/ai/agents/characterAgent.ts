import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import { TROPES_CLICHE_PROMPT, type Story } from '$lib/ai/agents/storyAgent';
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
		storyState: Story,
		partyOverwrites?: Partial<CharacterDescription>[] | string,
		partySize: number = 4
	): Promise<CharacterDescription[]> {
		const partyPrompt = Array(partySize).fill(characterDescriptionForPrompt).join(',\n');
		const agentInstruction = [
			`You are RPG character agent, creating a party of ${partySize} diverse character${partySize > 1 ? 's' : ''} for an RPG adventure.\n` +
				(partySize > 1
					? `Create ${partySize} unique characters that complement each other with different classes, races, and personalities.\n` +
						'Ensure the party has a good balance of combat, magic, support, and social skills.\n'
					: 'Create a unique character suitable for solo adventuring.\n') +
				TROPES_CLICHE_PROMPT
		];
		agentInstruction.push(jsonRule + '\n[\n' + partyPrompt + '\n]');

		const preset = partyOverwrites || Array(partySize).fill({});
		const request: LLMRequest = {
			userMessage:
				`Create a party of ${partySize} character${partySize > 1 ? 's' : ''} for this adventure:\n` +
				stringifyPretty(storyState) +
				'\n\nMake sure to create characters that fit the following description:\n' +
				storyState.party_description +
				(preset ? '\n\nParty overwrites:\n' + stringifyPretty(preset) : ''),
			systemInstruction: agentInstruction
		};
		return (await this.llm.generateContent(request))?.content as CharacterDescription[];
	}
}
