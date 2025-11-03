import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';
import type { Resources } from '$lib/ai/agents/characterStatsAgent';

/**
 * Normalize a base CharacterStatsAgent resources object (no current_value) into runtime ResourcesWithCurrentValue.
 * Chooses current_value = start_value if provided else max_value.
 */
export function normalizeResources(base: Resources): ResourcesWithCurrentValue {
	const normalized: ResourcesWithCurrentValue = {};
	Object.entries(base || {}).forEach(([key, value]) => {
		if (!value) return;
		normalized[key] = {
			max_value: value.max_value,
			current_value: (value as any).current_value ?? value.start_value ?? value.max_value,
			game_ends_when_zero: value.game_ends_when_zero
		};
	});
	return normalized;
}

/** Quick shape check: does object look like ResourcesWithCurrentValue (first value has current_value). */
export function hasCurrentValues(obj: unknown): obj is ResourcesWithCurrentValue {
	if (!obj || typeof obj !== 'object') return false;
	const first = Object.values(obj as Record<string, any>)[0];
	return !!first && typeof first === 'object' && 'current_value' in first;
}

/** Ensure an entry exists and is normalized for given characterId. */
export function ensureCharacterResources(
	store: Record<string, ResourcesWithCurrentValue>,
	characterId: string,
	base: Resources
) {
	if (!characterId) return;
	const existing = store[characterId];
	if (!existing || !hasCurrentValues(existing)) {
		store[characterId] = normalizeResources(base);
	}
}
