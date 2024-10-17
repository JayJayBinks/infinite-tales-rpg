import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';

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
		characterOverwrites: Partial<CharacterDescription> | undefined = undefined
	): Promise<CharacterDescription> {
		const agentInstruction =
			'You are RPG character agent, describing a character according to game system, adventure and character description.\n' +
			'Always respond with following JSON!\n' +
			characterDescriptionForPrompt;

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
