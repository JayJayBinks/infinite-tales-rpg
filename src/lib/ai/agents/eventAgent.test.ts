import { describe, expect, it, vi } from 'vitest';
import { EventAgent } from '$lib/ai/agents/eventAgent';
import type { LLM } from '$lib/ai/llm';

function localLLM(): LLM {
	return {
		llmConfig: { provider: 'openai-compatible' },
		generateContent: vi.fn(async () => ({
			thoughts: '',
			content: {
				reasoning: 'No event.',
				character_changed: null,
				abilities_learned: []
			}
		})),
		generateContentStream: vi.fn(),
		getDefaultTemperature: () => 0.7,
		getMaxTemperature: () => 2
	} as unknown as LLM;
}

describe('EventAgent local optimization', () => {
	it('always evaluates local events but uses compact local metadata', async () => {
		const llm = localLLM();
		const agent = new EventAgent(llm);

		const result = await agent.evaluateEvents(
			['The corridor is quiet. The character studies the brass panel and waits.'],
			['Lockpicking']
		);

		expect(llm.generateContent).toHaveBeenCalledOnce();
		expect(vi.mocked(llm.generateContent).mock.calls[0][0]).toMatchObject({
			responseJsonSchema: expect.any(Object),
			debugMetadata: {
				promptViewType: 'event'
			}
		});
		expect(result.event_evaluation.abilities_learned?.abilities).toEqual([]);
	});
});
