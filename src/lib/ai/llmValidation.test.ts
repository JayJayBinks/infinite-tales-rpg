import { describe, expect, it } from 'vitest';
import { validateCriticalLLMResponse } from '$lib/ai/llmValidation';

const context = {
	playerResourceKeys: ['HP', 'MP'],
	inventoryItemIds: ['torch', 'rope'],
	actionDifficulties: ['simple', 'medium', 'difficult']
};

describe('validateCriticalLLMResponse', () => {
	it('accepts valid action and game-state fields', () => {
		const result = validateCriticalLLMResponse(
			{
				action_difficulty: 'medium',
				resource_cost: { resource_key: 'MP', cost: 2 },
				stats_update: [
					{ type: 'HP_lost', value: { result: '1d6+2' } },
					{ type: 'xp_gained', value: { result: 'SMALL' } }
				],
				inventory_update: [{ type: 'remove_item', item_id: 'torch' }],
				currently_present_npcs: {
					hostile: [{ uniqueTechnicalNameId: 'bandit_1', displayName: 'Bandit' }],
					friendly: [],
					neutral: []
				}
			},
			context
		);

		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('reports invalid resource keys, dice notation, inventory ids and difficulties', () => {
		const result = validateCriticalLLMResponse(
			{
				action_difficulty: 'impossible',
				resource_cost: { resource_key: 'STAMINA', cost: 1 },
				stats_update: [{ type: 'BLOOD_lost', value: { result: 'bad dice' } }],
				inventory_update: [{ type: 'remove_item', item_id: 'missing_item' }]
			},
			context
		);

		expect(result.valid).toBe(false);
		expect(result.errors.join('\n')).toContain('Invalid action_difficulty');
		expect(result.errors.join('\n')).toContain('Invalid resource_cost.resource_key');
		expect(result.errors.join('\n')).toContain('Invalid stats_update resource key');
		expect(result.errors.join('\n')).toContain('Invalid dice notation');
		expect(result.errors.join('\n')).toContain('Cannot remove unknown inventory item');
	});

	it('validates arrays of suggested actions', () => {
		const result = validateCriticalLLMResponse(
			[
				{ action_difficulty: 'simple', resource_cost: null },
				{ action_difficulty: 'legendary', resource_cost: null }
			],
			context
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
	});

	it('rejects no-op and raw stats update values', () => {
		const result = validateCriticalLLMResponse(
			{
				stats_update: [
					{ type: 'N/A', value: null },
					{ type: 'xp_gained', value: 'SMALL' }
				]
			},
			context
		);

		expect(result.valid).toBe(false);
		expect(result.errors.join('\n')).toContain('omit no-op updates');
		expect(result.errors.join('\n')).toContain('must be an object');
	});
});
