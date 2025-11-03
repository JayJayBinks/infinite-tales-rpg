import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from './AIService';
import { initialSystemInstructionsState } from '$lib/ai/llm';

describe('AIService', () => {
	let service: AIService;

	beforeEach(() => {
		service = new AIService();
	});

	describe('Initialization', () => {
		it('should not be initialized by default', () => {
			expect(service.isInitialized()).toBe(false);
		});

		it('should initialize with valid configuration', () => {
			service.initialize({
				apiKey: 'test-api-key',
				temperature: 0.7,
				systemInstructions: initialSystemInstructionsState,
				aiLanguage: 'English'
			});

			expect(service.isInitialized()).toBe(true);
		});

		it('should throw error when accessing agents before initialization', () => {
			expect(() => service.getGameAgent()).toThrow('AI Service not initialized');
			expect(() => service.getSummaryAgent()).toThrow('AI Service not initialized');
			expect(() => service.getCharacterAgent()).toThrow('AI Service not initialized');
			expect(() => service.getCombatAgent()).toThrow('AI Service not initialized');
			expect(() => service.getActionAgent()).toThrow('AI Service not initialized');
			expect(() => service.getEventAgent()).toThrow('AI Service not initialized');
		});
	});

	describe('Agent Access', () => {
		beforeEach(() => {
			service.initialize({
				apiKey: 'test-api-key',
				temperature: 0.7,
				systemInstructions: initialSystemInstructionsState,
				aiLanguage: 'English'
			});
		});

		it('should provide access to game agent', () => {
			const agent = service.getGameAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to summary agent', () => {
			const agent = service.getSummaryAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to character agent', () => {
			const agent = service.getCharacterAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to character stats agent', () => {
			const agent = service.getCharacterStatsAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to combat agent', () => {
			const agent = service.getCombatAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to campaign agent', () => {
			const agent = service.getCampaignAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to action agent', () => {
			const agent = service.getActionAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to event agent', () => {
			const agent = service.getEventAgent();
			expect(agent).toBeDefined();
		});

		it('should provide access to image prompt agent', () => {
			const agent = service.getImagePromptAgent();
			expect(agent).toBeDefined();
		});
	});

	describe('Configuration Updates', () => {
		beforeEach(() => {
			service.initialize({
				apiKey: 'test-api-key',
				temperature: 0.7,
				systemInstructions: initialSystemInstructionsState,
				aiLanguage: 'English'
			});
		});

		it('should update API key and reinitialize', () => {
			service.updateApiKey('new-api-key');
			expect(service.isInitialized()).toBe(true);
		});

		it('should update temperature and reinitialize', () => {
			service.updateTemperature(0.9);
			expect(service.isInitialized()).toBe(true);
		});

		it('should not throw when updating API key without initialization', () => {
			const newService = new AIService();
			expect(() => newService.updateApiKey('new-key')).not.toThrow();
		});

		it('should not throw when updating temperature without initialization', () => {
			const newService = new AIService();
			expect(() => newService.updateTemperature(0.5)).not.toThrow();
		});
	});

	describe('Multiple Initializations', () => {
		it('should handle multiple initializations', () => {
			service.initialize({
				apiKey: 'key-1',
				temperature: 0.7,
				systemInstructions: initialSystemInstructionsState,
				aiLanguage: 'English'
			});

			expect(service.isInitialized()).toBe(true);

			service.initialize({
				apiKey: 'key-2',
				temperature: 0.9,
				systemInstructions: initialSystemInstructionsState,
				aiLanguage: 'German'
			});

			expect(service.isInitialized()).toBe(true);
		});
	});
});
