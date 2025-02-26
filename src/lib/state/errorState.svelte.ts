class ErrorState {
	userMessage = $state();
	exception = $state();
	retryable = $state();

	clear = () => {
		this.userMessage = undefined;
		this.exception = undefined;
		this.retryable = undefined;
	};
}

export const errorState = new ErrorState();

let isGeminiThinkingOverloaded = $state(false);

export const getIsGeminiThinkingOverloaded = () => {
	return isGeminiThinkingOverloaded;
};

export const setIsGeminiThinkingOverloaded = (value: boolean) => {
	isGeminiThinkingOverloaded = value;
};

let isGeminiFlashExpOverloaded = $state(false);

export const getIsGeminiFlashExpOverloaded = () => {
	return isGeminiFlashExpOverloaded;
};

export const setIsGeminiFlashExpOverloaded = (value: boolean) => {
	isGeminiFlashExpOverloaded = value;
};
