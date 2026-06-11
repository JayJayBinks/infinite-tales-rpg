import { describe, expect, it } from 'vitest';
import { jsonRule } from '$lib/ai/agents/agentUtils';
import {
	normalizeLocalStrictJsonInstruction,
	shouldUseJsonObjectResponseFormat,
	strictLocalJsonRule
} from '$lib/ai/localJson';

describe('local JSON helpers', () => {
	it('replaces the analysis based JSON rule for local strict JSON', () => {
		const normalized = normalizeLocalStrictJsonInstruction(jsonRule + '{"story": string}');

		expect(normalized).toContain(strictLocalJsonRule);
		expect(normalized).not.toContain('<analysis>');
		expect(normalized).toContain('{"story": string}');
	});

	it('does not request json_object mode for top-level array prompts', () => {
		const useJsonObject = shouldUseJsonObjectResponseFormat([
			{ content: 'Return JSON format: [{"text": string}]' }
		]);

		expect(useJsonObject).toBe(false);
	});

	it('requests json_object mode for object prompts', () => {
		const useJsonObject = shouldUseJsonObjectResponseFormat([
			{ content: 'Return JSON format: {"story": string}' }
		]);

		expect(useJsonObject).toBe(true);
	});
});
