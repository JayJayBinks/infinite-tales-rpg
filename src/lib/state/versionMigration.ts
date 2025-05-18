import {
	defaultGameSettings,
	type GameActionState,
	type GameSettings
} from '$lib/ai/agents/gameAgent';

export const migrateIfApplicable = (key: string, state: unknown) => {
	if (!state) return state;
	let migrated = migrate051to06(key, state);
	migrated = migrate062to07(key, migrated);
	migrated = migrate09to10(key, migrated);
	migrated = migrate11to11_1(key, migrated);
	return migrated;
};

function migrate11to11_1(key, state) {
	if (key === 'gameSettingsState') {
		(state as GameSettings).randomEventsHandling = defaultGameSettings().randomEventsHandling;
	}
	return state;
}

function migrate09to10(key, state) {
	if (key === 'gameActionsState') {
		(state as GameActionState[]).forEach((action) => {
			if (action.stats_update) {
				action.stats_update.forEach((stat) => {
					if (stat.targetName) {
						return;
					}
					// @ts-expect-error no error here
					stat.targetName = stat.targetId;
					// @ts-expect-error no error here
					stat.sourceName = stat.sourceId;
				});
			}
		});
	}
	return state;
}

function migrate051to06(key, state) {
	if (key === 'characterStatsState') {
		//migrate saves before level feature
		if (!state.level) {
			state.level = 1;
		}
	}
	return state;
}

function migrate062to07(key, state) {
	if (key === 'characterStatsState') {
		if (state.resources.MAX_HP) {
			state.resources.HP = {
				max_value: state.resources.MAX_HP,
				start_value: state.resources.MAX_HP,
				game_ends_when_zero: true
			};
			state.resources.MP = {
				max_value: state.resources.MAX_MP,
				start_value: state.resources.MAX_MP,
				game_ends_when_zero: false
			};
			delete state.resources.MAX_HP;
			delete state.resources.MAX_MP;
		}
		state.spells_and_abilities.forEach((spell) => {
			if (spell.mp_cost) {
				spell.resource_cost = { cost: spell.mp_cost, resource_key: 'MP' };
				delete spell.mp_cost;
			}
		});
	}
	return state;
}
