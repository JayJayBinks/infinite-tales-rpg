/**
 * AI Configuration State Store
 * Manages AI-related configuration and settings
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { SystemInstructionsState } from '$lib/ai/llm';
import { initialSystemInstructionsState } from '$lib/ai/llm';

/**
 * AI configuration state store
 * Manages API keys, temperature, system instructions, and language settings
 */
export class AIStateStore {
	// API key for AI services
	apiKey = useLocalStorage<string>('apiKeyState', '');
	
	// Temperature setting for AI generation (0-1)
	temperature = useLocalStorage<number>('temperatureState', 0.7);
	
	// System instructions for AI agents
	systemInstructions = useLocalStorage<SystemInstructionsState>(
		'systemInstructionsState',
		initialSystemInstructionsState
	);
	
	// Language for AI generation
	language = useLocalStorage<string>('aiLanguage', 'English');
	
	/**
	 * Check if API key is configured
	 */
	get isConfigured(): boolean {
		return this.apiKey.value.length > 0;
	}
	
	/**
	 * Update API key
	 */
	updateApiKey(key: string) {
		this.apiKey.value = key;
	}
	
	/**
	 * Update temperature
	 */
	updateTemperature(temp: number) {
		this.temperature.value = Math.max(0, Math.min(1, temp));
	}
	
	/**
	 * Update system instructions
	 */
	updateSystemInstructions(instructions: SystemInstructionsState) {
		this.systemInstructions.value = instructions;
	}
	
	/**
	 * Update language
	 */
	updateLanguage(lang: string) {
		this.language.value = lang;
	}
	
	/**
	 * Reset AI configuration
	 */
	reset() {
		this.apiKey.reset();
		this.temperature.reset();
		this.systemInstructions.reset();
		this.language.reset();
	}
}

/**
 * Create and export a singleton AI state instance
 */
export const aiStateStore = new AIStateStore();
