class ErrorState {
	userMessage = $state();
	code = $state();
	exception = $state();
	retryable = $state();

	clear = () => {
		this.userMessage = undefined;
		this.code = undefined;
		this.exception = undefined;
		this.retryable = undefined;
	};
}

export const errorState = new ErrorState();

// --- Gemini model overload tracking (per-model instead of coarse flags) ---
// Map of model name -> overloaded boolean
let geminiModelOverloadState = $state<Record<string, boolean>>({});

export const isGeminiModelOverloaded = (model: string): boolean => {
	return !!geminiModelOverloadState[model];
};

export const setGeminiModelOverloaded = (model: string, value: boolean = true) => {
	geminiModelOverloadState[model] = value;
};

export const clearGeminiModelOverloads = () => {
	geminiModelOverloadState = {};
};
