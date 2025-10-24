/**
 * AIStateStore - Centralized state management for AI configuration and state
 * 
 * This store manages:
 * - AI configuration (API key, temperature, language)
 * - System instructions
 * - AI processing state
 * - Thoughts state
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { SystemInstructionsState } from '$lib/ai/llm';
import { initialSystemInstructionsState } from '$lib/ai/llm';
import type { ThoughtsState } from '$lib/util.svelte';
import { initialThoughtsState } from '$lib/util.svelte';
import type { AIConfig } from '$lib';

export class AIStateStore {
	// AI Configuration
	readonly apiKey = useLocalStorage<string>('apiKeyState');
	readonly temperature = useLocalStorage<number>('temperatureState');
	readonly aiLanguage = useLocalStorage<string>('aiLanguage');
	readonly systemInstructions = useLocalStorage<SystemInstructionsState>(
		'systemInstructionsState',
		initialSystemInstructionsState
	);
	readonly aiConfig = useLocalStorage<AIConfig>('aiConfigState');

	// AI Processing State
	readonly thoughts = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);

	// Ephemeral state (not persisted)
	isAiGenerating = $state(false);
	didAIProcessAction = $state(true);

	/**
	 * Set AI generating state
	 */
	setGenerating(generating: boolean): void {
		this.isAiGenerating = generating;
	}

	/**
	 * Reset AI state (for new game)
	 */
	resetAIState(): void {
		this.thoughts.reset();
		this.isAiGenerating = false;
		this.didAIProcessAction = true;
	}
}
