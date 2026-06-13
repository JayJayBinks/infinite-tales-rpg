import Dice from 'dice-notation-js';
import type { LLMValidationContext } from '$lib/ai/llm';

export type ValidationResult = {
	valid: boolean;
	errors: string[];
};

const xpValues = new Set(['SMALL', 'MEDIUM', 'HIGH']);

export function validateCriticalLLMResponse(
	content: unknown,
	context?: LLMValidationContext
): ValidationResult {
	if (!context) return { valid: true, errors: [] };

	const errors: string[] = [];
	const values = Array.isArray(content) ? content : [content];
	for (const value of values) {
		validateAction(value, context, errors);
		validateStatsUpdates(value, context, errors);
		validateInventoryUpdates(value, context, errors);
		validateCurrentlyPresentNpcs(value, errors);
	}

	return { valid: errors.length === 0, errors };
}

export function buildValidationRepairInstruction(errors: string[]): string {
	return (
		'Repair the JSON so it satisfies these validation rules. Keep all valid story text unchanged. ' +
		'Only adjust invalid structured fields. Validation errors:\n' +
		errors.map((error) => '- ' + error).join('\n')
	);
}

function validateAction(value: unknown, context: LLMValidationContext, errors: string[]): void {
	if (!isRecord(value)) return;
	const actionDifficulties = new Set(context.actionDifficulties || []);
	if (
		actionDifficulties.size > 0 &&
		typeof value.action_difficulty === 'string' &&
		!actionDifficulties.has(value.action_difficulty)
	) {
		errors.push(`Invalid action_difficulty "${value.action_difficulty}".`);
	}
	const resourceCost = value.resource_cost;
	if (isRecord(resourceCost)) {
		validatePlayerResourceKey(
			resourceCost.resource_key,
			context,
			errors,
			'resource_cost.resource_key'
		);
	}
}

function validateStatsUpdates(
	value: unknown,
	context: LLMValidationContext,
	errors: string[]
): void {
	if (!isRecord(value) || !Array.isArray(value.stats_update)) return;
	for (const update of value.stats_update) {
		if (!isRecord(update)) continue;
		validateStatsUpdateShape(update, errors);
		validateStatsUpdateType(update.type, context, errors);
		validateStatsUpdateValue(update.type, update.value, errors);
	}
}

function validateStatsUpdateShape(update: Record<string, any>, errors: string[]): void {
	if (update.type === 'N/A' || update.type === 'none' || update.type === 'null') {
		errors.push('stats_update must omit no-op updates instead of using type N/A/none/null.');
	}
	if (update.value === null || update.value === undefined) {
		errors.push('stats_update.value must be an object like {"result": value}.');
		return;
	}
	if (!isRecord(update.value)) {
		errors.push('stats_update.value must be an object like {"result": value}, not a raw value.');
	}
}

function validateStatsUpdateType(
	type: unknown,
	context: LLMValidationContext,
	errors: string[]
): void {
	if (typeof type !== 'string' || !type.includes('_')) return;
	const resourceKey = type.replace(/_(lost|gained)$/i, '');
	if (resourceKey === type) return;
	const allowed = new Set([...(context.playerResourceKeys || []), 'hp', 'mp', 'xp']);
	if (allowed.size > 3 && !allowed.has(resourceKey) && !allowed.has(resourceKey.toUpperCase())) {
		errors.push(`Invalid stats_update resource key "${resourceKey}".`);
	}
}

function validateStatsUpdateValue(type: unknown, value: unknown, errors: string[]): void {
	if (!isRecord(value) || typeof type !== 'string') return;
	const result = value.result;
	if (type.toLowerCase() === 'xp_gained') {
		if (typeof result === 'string' && !xpValues.has(result)) {
			errors.push(`Invalid XP gain value "${result}".`);
		}
		return;
	}
	if (typeof result === 'number') return;
	if (typeof result !== 'string') return;
	if (/^-?\d+$/.test(result)) return;
	try {
		Dice.detailed(result);
	} catch {
		errors.push(`Invalid dice notation "${result}".`);
	}
}

function validateInventoryUpdates(
	value: unknown,
	context: LLMValidationContext,
	errors: string[]
): void {
	if (!isRecord(value) || !Array.isArray(value.inventory_update)) return;
	const knownItems = new Set(context.inventoryItemIds || []);
	if (knownItems.size === 0) return;
	for (const update of value.inventory_update) {
		if (!isRecord(update)) continue;
		if (
			update.type === 'remove_item' &&
			typeof update.item_id === 'string' &&
			!knownItems.has(update.item_id)
		) {
			errors.push(`Cannot remove unknown inventory item "${update.item_id}".`);
		}
	}
}

function validateCurrentlyPresentNpcs(value: unknown, errors: string[]): void {
	if (!isRecord(value) || !isRecord(value.currently_present_npcs)) return;
	for (const group of ['hostile', 'friendly', 'neutral']) {
		const npcs = value.currently_present_npcs[group];
		if (!Array.isArray(npcs)) {
			errors.push(`currently_present_npcs.${group} must be an array.`);
			continue;
		}
		for (const npc of npcs) {
			if (
				!isRecord(npc) ||
				typeof npc.uniqueTechnicalNameId !== 'string' ||
				typeof npc.displayName !== 'string'
			) {
				errors.push(`currently_present_npcs.${group} contains an invalid NPC id object.`);
			}
		}
	}
}

function validatePlayerResourceKey(
	resourceKey: unknown,
	context: LLMValidationContext,
	errors: string[],
	fieldName: string
): void {
	if (resourceKey === undefined || resourceKey === null || resourceKey === '') return;
	if (typeof resourceKey !== 'string') {
		errors.push(`${fieldName} must be a string or null.`);
		return;
	}
	const allowed = new Set(context.playerResourceKeys || []);
	if (allowed.size > 0 && !allowed.has(resourceKey)) {
		errors.push(`Invalid ${fieldName} "${resourceKey}".`);
	}
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
