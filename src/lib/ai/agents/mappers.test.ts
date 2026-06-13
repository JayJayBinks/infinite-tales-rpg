import { describe, expect, it } from 'vitest';
import { mapStatsUpdates } from '$lib/ai/agents/mappers';

describe('stats update mappers', () => {
	it('drops no-op null stats updates instead of crashing', () => {
		const state = {
			stats_update: [
				{
					type: 'N/A',
					sourceName: 'System',
					targetName: 'System',
					value: null
				}
			]
		};

		mapStatsUpdates(state as any);

		expect(state.stats_update).toEqual([]);
	});

	it('maps raw xp values to result objects', () => {
		const state = {
			stats_update: [
				{
					type: 'xp_gained',
					targetName: 'Player',
					value: 'SMALL'
				}
			]
		};

		mapStatsUpdates(state as any);

		expect(state.stats_update[0].value).toEqual({ result: 'SMALL' });
	});
});
