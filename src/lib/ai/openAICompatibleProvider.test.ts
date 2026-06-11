import { describe, expect, it, vi } from 'vitest';
import { createChatCompletionWithOptionalJsonMode } from '$lib/ai/openAICompatibleProvider';

describe('createChatCompletionWithOptionalJsonMode', () => {
	it('retries without response_format when json mode is rejected', async () => {
		const create = vi.fn(async (body: any) => {
			if (body.response_format) throw new Error('unsupported response_format');
			return { ok: true, body };
		});

		const result = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			true
		);

		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
		expect(create.mock.calls[1][0].response_format).toBeUndefined();
		expect(result.jsonModeAttempted).toBe(true);
		expect(result.jsonModeRetriedWithout).toBe(true);
		expect(result.result.ok).toBe(true);
	});

	it('skips response_format when json object mode is disabled', async () => {
		const create = vi.fn(async (body: any) => ({ ok: true, body }));

		const result = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			false
		);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0].response_format).toBeUndefined();
		expect(result.jsonModeAttempted).toBe(false);
		expect(result.jsonModeRetriedWithout).toBe(false);
	});
});
