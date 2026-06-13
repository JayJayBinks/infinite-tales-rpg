import { describe, expect, it } from 'vitest';
import { buildLocalActionJsonSchema } from '$lib/ai/agents/actionSchema';

describe('buildLocalActionJsonSchema', () => {
	it('wraps local action lists in a root object', () => {
		const schema = buildLocalActionJsonSchema({
			attributes: ['Dexterity'],
			skills: ['Lockpicking'],
			newSkillsAllowed: false,
			array: true
		}).schema as any;

		expect(schema.type).toBe('object');
		expect(schema.required).toEqual(['actions']);
		expect(schema.properties.actions.type).toBe('array');
		expect(schema.properties.actions.minItems).toBe(3);
		expect(schema.properties.actions.maxItems).toBe(3);
	});
});
