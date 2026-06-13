export const LLM_DEBUG_STATE_KEY = 'llmDebugState';

export type LlmDebugState = {
	provider?: string;
	baseUrl?: string;
	model?: string;
	lastRequestStartedAt?: string;
	lastRequestDurationMs?: number;
	promptCharacters?: number;
	promptCharactersAfterBudget?: number;
	trimmedMessages?: number;
	strictJson?: boolean;
	jsonModeAttempted?: boolean;
	jsonModeRetriedWithout?: boolean;
	jsonSchemaAttempted?: boolean;
	jsonSchemaRetriedWithout?: boolean;
	responseFormatCapabilityCacheHit?: boolean;
	jsonSchemaCapability?: string;
	jsonObjectCapability?: string;
	sanitizingOrRepairUsed?: boolean;
	validationErrors?: string[];
	validationDetails?: string[];
	promptViewType?: string;
	promptPreview?: string;
	promptViewReductions?: string[];
	lastError?: string;
};

export function writeLlmDebugState(update: Partial<LlmDebugState>): void {
	if (typeof localStorage === 'undefined') return;
	const current = readLlmDebugState();
	localStorage.setItem(
		LLM_DEBUG_STATE_KEY,
		JSON.stringify({
			...current,
			...update
		})
	);
}

export function readLlmDebugState(): LlmDebugState {
	if (typeof localStorage === 'undefined') return {};
	const raw = localStorage.getItem(LLM_DEBUG_STATE_KEY);
	if (!raw) return {};
	try {
		return JSON.parse(raw) as LlmDebugState;
	} catch {
		return {};
	}
}
