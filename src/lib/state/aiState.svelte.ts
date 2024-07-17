class AIState {
    apiKey = $state();
    temperature = $state(2);
    isGenerating = $state(false)
}
export const aiState = new AIState();
