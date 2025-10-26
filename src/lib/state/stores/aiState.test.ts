import { describe, it, expect, beforeEach } from 'vitest';
import { AIStateStore } from './aiState.svelte';
import { initialSystemInstructionsState } from '$lib/ai/llm';

describe('AIStateStore', () => {
	let store: AIStateStore;

	beforeEach(() => {
		store = new AIStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with default values', () => {
			expect(store.apiKey.value).toBe('');
			expect(store.temperature.value).toBe(0.7);
			expect(store.systemInstructions.value).toEqual(initialSystemInstructionsState);
			expect(store.language.value).toBe('English');
		});

		it('should not be configured initially', () => {
			expect(store.isConfigured).toBe(false);
		});
	});

	describe('Configuration status', () => {
		it('should be configured when API key is set', () => {
			store.updateApiKey('test-key');
			expect(store.isConfigured).toBe(true);
		});

		it('should not be configured with empty API key', () => {
			store.updateApiKey('');
			expect(store.isConfigured).toBe(false);
		});
	});

	describe('API key management', () => {
		it('should update API key', () => {
			store.updateApiKey('my-api-key');
			expect(store.apiKey.value).toBe('my-api-key');
		});
	});

	describe('Temperature management', () => {
		it('should update temperature', () => {
			store.updateTemperature(0.5);
			expect(store.temperature.value).toBe(0.5);
		});

		it('should clamp temperature to 0-1 range (upper bound)', () => {
			store.updateTemperature(1.5);
			expect(store.temperature.value).toBe(1);
		});

		it('should clamp temperature to 0-1 range (lower bound)', () => {
			store.updateTemperature(-0.5);
			expect(store.temperature.value).toBe(0);
		});
	});

	describe('System instructions management', () => {
		it('should update system instructions', () => {
			const newInstructions = {
				...initialSystemInstructionsState,
				generalSystemInstruction: 'Custom instruction'
			};
			store.updateSystemInstructions(newInstructions);
			expect(store.systemInstructions.value.generalSystemInstruction).toBe('Custom instruction');
		});
	});

	describe('Language management', () => {
		it('should update language', () => {
			store.updateLanguage('German');
			expect(store.language.value).toBe('German');
		});
	});

	describe('Reset', () => {
		it('should reset all AI state', () => {
			store.updateApiKey('test-key');
			store.updateTemperature(0.9);
			store.updateLanguage('French');

			store.reset();

			expect(store.apiKey.value).toBe('');
			expect(store.temperature.value).toBe(0.7);
			expect(store.language.value).toBe('English');
		});
	});
});
