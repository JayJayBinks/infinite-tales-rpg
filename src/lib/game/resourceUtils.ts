import type { Resources } from '$lib/ai/agents/characterStatsAgent';
import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';

/**
 * Normalize a base resources definition (without current_value) into a ResourcesWithCurrentValue map.
 * Uses start_value if present else max_value.
 */
export function normalizeResources(base?: Resources | null): ResourcesWithCurrentValue {
	const result: ResourcesWithCurrentValue = {};
	if (!base) return result;
	for (const [key, res] of Object.entries(base)) {
		if (!res) continue;
		const start = (res as any).start_value ?? res.max_value;
		result[key] = {
			max_value: res.max_value,
			current_value: start,
			game_ends_when_zero: res.game_ends_when_zero
		};
	}
	return result;
}

/** Merge existing runtime resources with a base definition, ensuring no missing current_value fields. */
export function ensureCurrentValues(
	runtime: ResourcesWithCurrentValue | undefined,
	base?: Resources | null
): ResourcesWithCurrentValue {
	const normalized = normalizeResources(base);
	const out: ResourcesWithCurrentValue = { ...normalized };
	for (const [k, v] of Object.entries(runtime || {})) {
		if (!out[k]) {
			out[k] = { ...v };
			continue;
		}
		// preserve current_value if runtime has more recent one
		if (typeof v.current_value === 'number') {
			out[k].current_value = v.current_value;
		}
	}
	return out;
}
