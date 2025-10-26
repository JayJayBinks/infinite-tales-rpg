import { describe, it, expect } from 'vitest';
import { GameAgent, defaultGameSettings, type InventoryState } from './gameAgent';
import type { CharacterDescription } from './characterAgent';
import type { Story } from './storyAgent';
import { LLM, type LLMRequest } from '$lib/ai/llm';

// Minimal dummy LLM implementation for invoking private method paths (no actual generation used here)
class DummyLLM extends LLM {
	constructor() {
		// @ts-ignore
		super({});
	}
	async generateContent() { return { thoughts: '', content: {} }; }
	async generateContentStream() { return {}; }
	getDefaultTemperature() { return 0; }
	getMaxTemperature() { return 1; }
}

// Helpers
const storyState = { storyProgressions: [], general_image_prompt: '' } as unknown as Story;
const characterState = { name: 'Aria' } as unknown as CharacterDescription;
const inventory: InventoryState = {};
const settings = defaultGameSettings();

function extractIsParty(instructions: string[]): boolean {
	const joined = instructions.join('\n');
	return joined.includes("The following are all party members' CURRENT resources");
}

function extractIsSingle(instructions: string[]): boolean {
	const joined = instructions.join('\n');
	return joined.includes("The following are the character's CURRENT resources");
}

describe('GameAgent resource shape classification', () => {
	const agent = new GameAgent(new DummyLLM());
	const invoke = (state: any) => (agent as any).getGameAgentSystemInstructionsFromStates(
		storyState,
		characterState,
		state,
		inventory,
		'',
		'',
		'',
		settings
	);

	it('handles undefined player state gracefully (treated as single)', () => {
		const instr = invoke(undefined);
		expect(extractIsSingle(instr)).toBe(true);
		expect(() => invoke(undefined)).not.toThrow();
	});

	it('handles empty object (single)', () => {
		const instr = invoke({});
		expect(extractIsSingle(instr)).toBe(true);
	});

	it('single-character without current_value still classified as single', () => {
		const singleNoCurrent = {
			HP: { max_value: 10, start_value: 10, game_ends_when_zero: true },
			MP: { max_value: 5, start_value: 5, game_ends_when_zero: false }
		};
		const instr = invoke(singleNoCurrent);
		expect(extractIsSingle(instr)).toBe(true);
		expect(extractIsParty(instr)).toBe(false);
	});

	it('single-character with current_value classified as single', () => {
		const singleWithCurrent = {
			HP: { max_value: 10, current_value: 7, game_ends_when_zero: true },
			MP: { max_value: 5, current_value: 5, game_ends_when_zero: false }
		};
		const instr = invoke(singleWithCurrent);
		expect(extractIsSingle(instr)).toBe(true);
	});

	it('party mapping classification', () => {
		const party = {
			member_1: {
				HP: { max_value: 10, current_value: 9, game_ends_when_zero: true }
			},
			member_2: {
				HP: { max_value: 12, current_value: 12, game_ends_when_zero: true },
				MP: { max_value: 4, current_value: 3, game_ends_when_zero: false }
			}
		};
		const instr = invoke(party);
		expect(extractIsParty(instr)).toBe(true);
		expect(extractIsSingle(instr)).toBe(false);
	});
});
