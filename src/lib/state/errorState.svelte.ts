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

let isGeminiOverloaded = $state(false);

export const getIsGeminiOverloaded = () => {
	return isGeminiOverloaded;
};

export const setIsGeminiOverloaded = (value: boolean) => {
	isGeminiOverloaded = value;
};
