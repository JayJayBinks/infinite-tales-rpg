import { THINKING_BUDGET } from '../geminiProvider';
import type { LLM, LLMRequest } from '../llm';

export class JsonFixingInterceptorAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async fixJSON(json: string, error: string, reportErrorToUser): Promise<object | undefined> {
		const agent =
			'You are JSON fixing agent, who is responsible for fixing JSON errors. ' +
			'You will be given JSON with errors and an error message and must fix it. Respond only with the fixed JSON, do not explain errors!';

		const request: LLMRequest = {
			userMessage: error,
			historyMessages: [
				{
					role: 'user',
					content: json
				}
			],
			thinkingConfig: {
				thinkingBudget: THINKING_BUDGET.FAST
			},
			systemInstruction: agent,
			temperature: 0,
			tryAutoFixJSONError: false,
			reportErrorToUser
		};
		return (await this.llm.generateContent(request))?.content;
	}
}
