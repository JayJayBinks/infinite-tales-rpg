import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';

export const uiTechnicalInstructions = 'The HTML, CSS and JS will be dynamically rendered it inside the game app, so you must include all game logic and no placeholders.\n' +
	'Display the nested game state in a UX friendly way directly in the game screen or via dialog.\n' +
	'Use DaisyUI and Tailwind for CSS and plain javascript\n' +
	'Never use dropdown but only HTML tag dialog with show but not showModal method.\n' +
	'For buttons always add the btn class\n' +
	'You can generate AI images with source https://image.pollinations.ai/prompt/{prompt}\n' +
	'Never use DOMContentLoaded, create a method renderGameState that updates the HTML elements with the gameState values\n' +
	'Make sure to call renderGameState\n' +
	'Make sure that the javascript is null safe for game state values\n' +
	'Return JSON with properties "html" "javascript" and "css"\n' +
	'Inside the javascript do not repeat the input game state, access directly via window.gameState\n' +
	'Function calling: \n' +
	'You can call the following functions inside the generated js:\n' +
	'	async window.sendToGameMasterToGenerateNextGameState(characterAction: string, gameMasterHints: any, contextualInfo: any)\n' +
	'	async window.roll1D20andGetResultAsNumber(): number';

export const uiFeatureInstructions = 'Game features:\n' +
	'Consider the theme of the general story settings. E.g. a cyberpunk RPG should have a complete different style than a fantasy RPG.\n' +
	'Never mention secrets and meta elements that only the Game Master knows, such as Difficulty class\n' +
	'When player chooses an action that has difficulty above simple, use roll1D20andGetResultAsNumber function for rolling dice. Then show the result to the player and let them confirm. (use dialog)\n' +
	'Player can use an item and choose from suggested actions for that item (use dialog)\n' +
	'You can even invent new UI elements which make use of of game state.';

export class UIAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async regenerateUIForGameState(
		gameState: any,
		storyState: string,
		uiInstructionsState?: any,
		uiTempContext?: string[],
		currentUI?: any
	): Promise<{ html: string; css: string, javascript: string }> {
		const gameAgent = ['Create UX friendly UI for the given game state\n' + uiInstructionsState?.uiTechnicalInstructions || uiTechnicalInstructions,
			uiInstructionsState?.uiFeatureInstructions || uiFeatureInstructions
		];
		gameAgent.push('\n\nConsider following general settings to generate the UI\n' + storyState);

		let userMessage = 'Create UI for the following game state\n' + stringifyPretty(gameState);
		if(uiTempContext?.length || 0 > 0){
			userMessage += '\n\n' + 'Consider the following requests from the player:\n' + uiTempContext!.join('\n');
		}
		if(currentUI){
			userMessage += '\n\n' + 'Update the current UI only:\n' + JSON.stringify(currentUI);
		}
		const request: LLMRequest = {
			userMessage,
			historyMessages: [],
			systemInstruction: gameAgent
		};

		const newState = (await this.llm.generateReasoningContent(request))
			?.parsedObject as any;
		return newState;
	}
}