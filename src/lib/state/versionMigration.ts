export const migrateIfApplicable = (key: string, state: any) => {
	if (!state) return state;
	let migrated = migrate051to06(key, state);
	migrated = migrate062to07(key, migrated);
	return migrated;
};

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
				game_ends_when_zero: true
			};
			state.resources.MP = {
				max_value: state.resources.MAX_MP,
				game_ends_when_zero: false
			};
			delete state.resources.MAX_HP;
			delete state.resources.MAX_MP;
		}
		state.spells_and_abilities.forEach(spell => {	
			if(spell.mp_cost) {	
				spell.resource_cost = {cost: spell.mp_cost, resource_key: 'MP'};
				delete spell.mp_cost;
			}
		});
	}
	return state;
}
