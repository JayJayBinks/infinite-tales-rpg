import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import { TROPES_CLICHE_PROMPT } from '$lib/ai/agents/storyAgent';

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
		agentInstruction.push('Always respond with following JSON!\n' + characterDescriptionForPrompt);

		const preset = {
			...storyState,
			...characterOverwrites
		};
		const request: LLMRequest = {
			userMessage: 'Create the character: ' + stringifyPretty(preset),
			systemInstruction: agentInstruction
		};
		return (await this.llm.generateContent(request)) as CharacterDescription;
	}
}
