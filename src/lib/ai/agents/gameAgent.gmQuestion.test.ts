import { describe, expect, it, vi } from 'vitest';
import {
	defaultGameSettings,
	GameAgent,
	type GameMasterAnswer
} from '$lib/ai/agents/gameAgent';
import type { LLM } from '$lib/ai/llm';
import { initialSystemInstructionsState } from '$lib/ai/llm';
import { initialThoughtsState } from '$lib/util.svelte';

describe('GameAgent local GM questions', () => {
	it('separates the overview and requested detail into two compact calls', async () => {
		const generateContent = vi
			.fn()
			.mockResolvedValueOnce({
				thoughts: '',
				content: {
					answerToPlayer: 'The attempt is possible, but the sealed hatch still blocks access.',
					availableDetails: [{ id: 'rules', title: 'Relevant Rules' }]
				}
			})
			.mockResolvedValueOnce({
				thoughts: '',
				content: {
					content: 'The action must be resolved gradually and cannot bypass the obstacle instantly.'
				}
			});
		const llm = {
			llmConfig: { provider: 'openai-compatible' },
			generateContent,
			generateContentStream: vi.fn(),
			getDefaultTemperature: () => 0.7,
			getMaxTemperature: () => 2
		} as unknown as LLM;
		const agent = new GameAgent(llm);
		const story = {
			game: 'Test RPG',
			world_details: 'A Ministry district with sealed service hatches.',
			adventure_and_main_event: 'Investigate the Mire-Net.',
			character_simple_description: 'An investigator.',
			general_image_prompt: '',
			theme: 'Mystery',
			tonality: 'Tense'
		};
		const answerResult = await agent.generateAnswerForPlayerQuestion(
			'Can I open the sealed hatch immediately?',
			initialThoughtsState,
			initialSystemInstructionsState,
			[],
			story,
			{ name: 'Joric', appearance: 'Investigator' } as any,
			{},
			{},
			{},
			[],
			defaultGameSettings()
		);

		const detail = await agent.generateAnswerForPlayerQuestionDetail(
			'rules',
			'Can I open the sealed hatch immediately?',
			answerResult.answer as GameMasterAnswer,
			initialSystemInstructionsState,
			[],
			story,
			{ name: 'Joric', appearance: 'Investigator' } as any,
			{},
			{},
			{},
			[],
			defaultGameSettings()
		);

		expect(generateContent).toHaveBeenCalledTimes(2);
		expect(generateContent.mock.calls[0][0].debugMetadata.promptViewType).toBe('gm-question');
		expect(generateContent.mock.calls[1][0].debugMetadata.promptViewType).toBe(
			'gm-question-rules'
		);
		expect(detail?.content).toContain('resolved gradually');
	});
});
