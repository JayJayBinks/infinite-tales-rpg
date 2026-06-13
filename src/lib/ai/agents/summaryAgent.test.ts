import { describe, expect, it, vi } from 'vitest';
import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
import type { LLM } from '$lib/ai/llm';
import type { GameActionState } from '$lib/ai/agents/gameAgent';

function localLLM(content: object): LLM {
	return {
		llmConfig: { provider: 'openai-compatible' },
		generateContent: vi.fn(async () => ({ thoughts: '', content })),
		generateContentStream: vi.fn(),
		getDefaultTemperature: () => 0.7,
		getMaxTemperature: () => 2
	} as unknown as LLM;
}

function gameState(id: number, story: string): GameActionState {
	return {
		id,
		story,
		image_prompt: '',
		currentPlotPoint: '',
		nextPlotPoint: '',
		stats_update: [],
		inventory_update: [],
		story_memory_explanation: 'LONG_TERM_IMPACT: HIGH',
		currently_present_npcs: { hostile: [], friendly: [], neutral: [] },
		is_character_in_combat: false
	} as GameActionState;
}

describe('SummaryAgent local related history', () => {
	it('uses extracted specific search terms for local history search', async () => {
		const llm = localLLM({
			specificKeywords: ['Mire-Net service hatch'],
			entities: ['Joric Synapse'],
			locations: ['Ministry district'],
			plotHooks: []
		});
		const agent = new SummaryAgent(llm);
		const states = [
			gameState(1, 'Joric Synapse found a hidden Mire-Net service hatch below the Ministry district.'),
			...Array.from({ length: 25 }, (_, index) =>
				gameState(index + 2, `Unrelated market scene ${index}`)
			)
		];

		const result = await agent.retrieveRelatedHistory('Inspect the service hatch again', states, 2);

		expect(llm.generateContent).toHaveBeenCalledOnce();
		expect(result.relatedDetails[0].storyReference).toContain('Mire-Net service hatch');
	});

	it('skips local related history work for short histories without custom memories', async () => {
		const llm = localLLM({
			specificKeywords: ['Mire-Net service hatch'],
			entities: [],
			locations: [],
			plotHooks: []
		});
		const agent = new SummaryAgent(llm);

		const result = await agent.retrieveRelatedHistory('Inspect the service hatch', [], 2);

		expect(llm.generateContent).not.toHaveBeenCalled();
		expect(result.relatedDetails).toEqual([]);
	});

	it('filters multilingual generic terms so they do not dominate local history search', async () => {
		const llm = localLLM({
			specificKeywords: ['Stadt', 'Magie', 'service hatch'],
			entities: [],
			locations: ['ciudad'],
			plotHooks: ['Mire-Net bypass']
		});
		const agent = new SummaryAgent(llm);
		const states = [
			gameState(1, 'Eine Stadt voller Magie wird von unbekannten Feinden bedroht.'),
			gameState(2, 'Joric found a service hatch with a Mire-Net bypass below the Ministry.'),
			...Array.from({ length: 25 }, (_, index) =>
				gameState(index + 3, `Unrelated city magic scene ${index}`)
			)
		];

		const result = await agent.retrieveRelatedHistory('Use the service hatch again', states, 2);

		expect(result.relatedDetails[0].storyReference).toContain('Mire-Net bypass');
		expect(result.relatedDetails.map((detail) => detail.storyReference).join('\n')).not.toContain(
			'Eine Stadt voller Magie'
		);
	});
});
