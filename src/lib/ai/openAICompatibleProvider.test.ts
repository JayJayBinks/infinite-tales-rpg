import { describe, expect, it, vi } from 'vitest';
import {
	createChatCompletionWithOptionalJsonMode,
	type ResponseFormatCapabilities
} from '$lib/ai/openAICompatibleProvider';

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
		expect(result.jsonSchemaAttempted).toBe(false);
		expect(result.result.ok).toBe(true);
	});

	it('tries json_schema before json_object when schema is provided', async () => {
		const create = vi.fn(async (body: any) => {
			if (body.response_format?.type === 'json_schema') throw new Error('unsupported schema');
			return { ok: true, body };
		});

		const result = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			true,
			{
				name: 'test_schema',
				strict: true,
				schema: {
					type: 'object',
					properties: { ok: { type: 'boolean' } },
					required: ['ok'],
					additionalProperties: false
				}
			}
		);

		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[0][0].response_format).toEqual({
			type: 'json_schema',
			json_schema: {
				name: 'test_schema',
				strict: true,
				schema: {
					type: 'object',
					properties: { ok: { type: 'boolean' } },
					required: ['ok'],
					additionalProperties: false
				}
			}
		});
		expect(create.mock.calls[1][0].response_format).toEqual({ type: 'json_object' });
		expect(result.jsonModeAttempted).toBe(true);
		expect(result.jsonSchemaAttempted).toBe(true);
		expect(result.jsonSchemaRetriedWithout).toBe(true);
		expect(result.jsonModeRetriedWithout).toBe(false);
	});

	it('falls back without response_format when schema and json_object are rejected', async () => {
		const create = vi.fn(async (body: any) => {
			if (body.response_format) throw new Error('unsupported response_format');
			return { ok: true, body };
		});

		const result = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			true,
			{
				name: 'test_schema',
				schema: { type: 'object', properties: {}, additionalProperties: false }
			}
		);

		expect(create).toHaveBeenCalledTimes(3);
		expect(create.mock.calls[0][0].response_format?.type).toBe('json_schema');
		expect(create.mock.calls[1][0].response_format).toEqual({ type: 'json_object' });
		expect(create.mock.calls[2][0].response_format).toBeUndefined();
		expect(result.jsonSchemaAttempted).toBe(true);
		expect(result.jsonSchemaRetriedWithout).toBe(true);
		expect(result.jsonModeRetriedWithout).toBe(true);
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
		expect(result.jsonSchemaAttempted).toBe(false);
	});

	it('reuses cached unsupported capabilities on later calls', async () => {
		const capabilities: ResponseFormatCapabilities = {
			jsonSchema: 'unknown',
			jsonObject: 'unknown'
		};
		const create = vi.fn(async (body: any) => {
			if (body.response_format?.type === 'json_schema') {
				throw new Error('unsupported json_schema response_format');
			}
			return { ok: true, body };
		});
		const schema = {
			name: 'test_schema',
			schema: {
				type: 'object',
				properties: { ok: { type: 'boolean' } },
				required: ['ok'],
				additionalProperties: false
			}
		};

		const first = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			true,
			schema,
			capabilities
		);
		const second = await createChatCompletionWithOptionalJsonMode(
			create,
			{ model: 'local-model', stream: false },
			true,
			schema,
			capabilities
		);

		expect(create).toHaveBeenCalledTimes(3);
		expect(create.mock.calls[0][0].response_format?.type).toBe('json_schema');
		expect(create.mock.calls[1][0].response_format?.type).toBe('json_object');
		expect(create.mock.calls[2][0].response_format?.type).toBe('json_object');
		expect(first.responseFormatCapabilities).toEqual({
			jsonSchema: 'unsupported',
			jsonObject: 'supported'
		});
		expect(second.jsonSchemaAttempted).toBe(false);
		expect(second.responseFormatCapabilityCacheHit).toBe(true);
	});
});
