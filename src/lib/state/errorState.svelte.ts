class ErrorState {
	userMessage = $state();
	exception = $state();

	clear = () => {
		this.userMessage = undefined;
		this.exception = undefined;
	};
}

export const errorState = new ErrorState();
