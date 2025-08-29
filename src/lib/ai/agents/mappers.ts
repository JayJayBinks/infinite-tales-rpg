import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { DiceRoll, StatsUpdate } from '$lib/ai/agents/combatAgent';
import Dice from 'dice-notation-js';

export function mapGameState(state: GameActionState) {
	if (state) {
		mapStatsUpdates(state);
	}
}

export function mapStatsUpdates(object: Pick<GameActionState, 'stats_update'>) {
	object.stats_update = object.stats_update?.map((statUpdate) => mapStatsUpdate(statUpdate));
}

export function mapStatsUpdate(stats_update): StatsUpdate {
	let parsed: DiceRoll;

	function tryMapAnyResult(stats_update) {
		return { result: Number.parseInt(stats_update.value) || Number.parseInt(stats_update.value?.result) || Number.parseInt(stats_update.value?.result?.result)
				|| stats_update.value };
	}

	try {
		parsed = Dice.detailed(stats_update.value);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (e) {
		parsed = tryMapAnyResult(stats_update);
	}
	return { ...stats_update, value: parsed };
}
