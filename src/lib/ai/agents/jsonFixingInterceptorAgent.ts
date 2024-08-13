import {GeminiProvider} from "../llmProvider";


export class JsonFixingInterceptorAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async fixJSON(json, error) {
        let agent = "You are JSON fixing agent, who is responsible for fixing JSON errors. " +
            "You will be given JSON with errors and an error message and must fix it. Respond only with the fixed JSON, do not explain errors!";

        return await this.llmProvider.sendToAINoAutoFix(
            [{
                "role": "user",
                "parts": [{"text": json}]
            },
                {
                    "role": "user",
                    "parts": [{"text": error}]
                }],
            agent,
            0
        );
    }

}
