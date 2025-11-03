import { describe, it, expect } from 'vitest';
import { GameAgent } from './gameAgent';
import type { LLM, LLMRequest, LLMResponse } from '../llm';

// Minimal stub LLM (only to satisfy GameAgent constructor; tests call private method via cast)
class StubLLM implements LLM {
	generateContent(_: LLMRequest): Promise<LLMResponse | undefined> { return Promise.resolve(undefined); }
	generateContentStream() { return Promise.resolve(undefined as any); }
}

const storyState: any = { story: 'Test story' };
const characterState: any = { name: 'Hero' };
const inventory: any = {};
const settings: any = { detailedNarrationLength: true };

function extractResourceLine(arr: string[]): string | undefined {
	return arr.find(l => l.includes("CURRENT resources") || l.includes("party members' CURRENT resources"));
}

describe('GameAgent.getGameAgentSystemInstructionsFromStates classification', () => {
	const agent: any = new GameAgent(new StubLLM());

	it('handles undefined player state gracefully (treated as party)', () => {
		const instr = agent.getGameAgentSystemInstructionsFromStates(
			storyState,
			characterState,
			undefined,
			inventory,
			'', '', '', settings
		);
		expect(instr).toBeTruthy();
		const line = extractResourceLine(instr);
		expect(line).toMatch(/party members' CURRENT resources/);
	});

	it('handles empty object player state (party mode)', () => {
		const instr = agent.getGameAgentSystemInstructionsFromStates(
			storyState,
			characterState,
			{},
			inventory,
			'', '', '', settings
		);
		const line = extractResourceLine(instr);
		expect(line).toMatch(/party members' CURRENT resources/);
	});

	it('party with single member', () => {
		const singleMemberParty = { 
			player_character_1: { 
				HP: { max_value: 10, current_value: 10, game_ends_when_zero: true } 
			} 
		} as any;
		const instr = agent.getGameAgentSystemInstructionsFromStates(
			storyState, characterState, singleMemberParty, inventory, '', '', '', settings
		);
		const line = extractResourceLine(instr);
		expect(line).toMatch(/party members' CURRENT resources/);
	});

	it('party with multiple members', () => {
		const partyMapping = {
			member1: { HP: { max_value: 10, current_value: 10, game_ends_when_zero: true } },
			member2: { MP: { max_value: 5, current_value: 5, game_ends_when_zero: false } }
		} as any;
		const instr = agent.getGameAgentSystemInstructionsFromStates(
			storyState, characterState, partyMapping, inventory, '', '', '', settings
		);
		const line = extractResourceLine(instr);
		expect(line).toMatch(/party members' CURRENT resources/);
	});
});
