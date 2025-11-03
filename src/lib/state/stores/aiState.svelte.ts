/**
 * AI Configuration State Store
 * Manages AI-related configuration and settings
 */

import type { SystemInstructionsState } from '$lib/ai/llm';
import { initialSystemInstructionsState } from '$lib/ai/llm';
import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';

// (helpers centralized in localStorageUtil.ts)

/**
 * AI configuration state store
 * Manages API keys, temperature, system instructions, and language settings
 */
export class AIStateStore {
	// API key for AI services
	private _apiKey = $state<string>(getFromLocalStorage('apiKeyState', ''));
	
	// Temperature setting for AI generation (0-1)
	private _temperature = $state<number>(getFromLocalStorage('temperatureState', 0.7));
	
	// System instructions for AI agents
	private _systemInstructions = $state<SystemInstructionsState>(
		getFromLocalStorage('systemInstructionsState', initialSystemInstructionsState)
	);
	
	// Language for AI generation
	private _language = $state<string>(getFromLocalStorage('aiLanguage', 'English'));
	
	get apiKey() {
		return this._apiKey;
	}
	
	set apiKey(value: string) {
		this._apiKey = value;
		saveToLocalStorage('apiKeyState', value);
	}
	
	get temperature() {
		return this._temperature;
	}
	
	set temperature(value: number) {
		this._temperature = value;
		saveToLocalStorage('temperatureState', value);
	}
	
	get systemInstructions() {
		return this._systemInstructions;
	}
	
	set systemInstructions(value: SystemInstructionsState) {
		this._systemInstructions = value;
		saveToLocalStorage('systemInstructionsState', value);
	}
	
	get language() {
		return this._language;
	}
	
	set language(value: string) {
		this._language = value;
		saveToLocalStorage('aiLanguage', value);
	}
	
	/**
	 * Check if API key is configured
	 */
	get isConfigured(): boolean {
		return this._apiKey.length > 0;
	}
	
	/**
	 * Update API key
	 */
	updateApiKey(key: string) {
		this.apiKey = key;
	}
	
	/**
	 * Update temperature
	 */
	updateTemperature(temp: number) {
		this.temperature = Math.max(0, Math.min(1, temp));
	}
	
	/**
	 * Update system instructions
	 */
	updateSystemInstructions(instructions: SystemInstructionsState) {
		this.systemInstructions = instructions;
	}
	
	/**
	 * Update language
	 */
	updateLanguage(lang: string) {
		this.language = lang;
	}
	
	/**
	 * Reset AI configuration
	 */
	reset() {
		this.apiKey = '';
		this.temperature = 0.7;
		this.systemInstructions = initialSystemInstructionsState;
		this.language = 'English';
	}
}

/**
 * Create and export a singleton AI state instance
 */
export const aiStateStore = new AIStateStore();
