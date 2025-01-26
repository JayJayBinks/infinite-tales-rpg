export const migrateIfApplicable = (key: string, state: any) => {
	if (!state) return state;
	const migrated = migrate051to06(key, state);
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
