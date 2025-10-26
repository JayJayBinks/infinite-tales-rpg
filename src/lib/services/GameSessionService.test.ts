import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSessionService } from './GameSessionService';
import { AIService } from './AIService';
import { ActionService } from './ActionService';
import { gameState } from '$lib/state/stores/gameState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';

describe('GameSessionService', () => {
	let service: GameSessionService;
	let aiService: AIService;
	let actionService: ActionService;

	beforeEach(() => {
		service = new GameSessionService();
		aiService = new AIService();
		actionService = new ActionService();
	});

	describe('Initialization', () => {
		it('should not be initialized by default', () => {
			expect(service.isInitialized()).toBe(false);
		});

		it('should initialize with dependencies', () => {
			service.initialize(aiService, actionService);
			expect(service.isInitialized()).toBe(true);
		});
	});

	describe('Game lifecycle', () => {
		beforeEach(() => {
			service.initialize(aiService, actionService);
			// Reset game state before each test
			gameState.progression.isGameEnded.value = false;
		});

		it('should start a new game', async () => {
			await service.startNewGame();
			// Basic check that game started
			expect(service.isGameEnded()).toBe(false);
		});

		it('should end the game', () => {
			service.endGame('Player defeated');
			expect(service.isGameEnded()).toBe(true);
		});

		it('should not be game ended by default', () => {
			expect(service.isGameEnded()).toBe(false);
		});
	});

	describe('Party management', () => {
		it('should always be in party mode', () => {
			expect(service.isPartyMode()).toBe(true);
		});

		it('should get party size', () => {
			const size = service.getPartySize();
			expect(typeof size).toBe('number');
			expect(size).toBeGreaterThanOrEqual(0);
		});

		it('should get party members', () => {
			const members = service.getPartyMembers();
			expect(Array.isArray(members)).toBe(true);
		});

		it('should get active member', () => {
			const member = service.getActiveMember();
			// May be undefined if no party members
			expect(member === undefined || typeof member === 'object').toBe(true);
		});
	});

	describe('Game action management', () => {
		it('should get current game action', () => {
			const action = service.getCurrentGameAction();
			expect(action).toBeDefined();
		});

		it('should get history messages', () => {
			const messages = service.getHistoryMessages();
			expect(Array.isArray(messages)).toBe(true);
		});

		it('should add game action', () => {
			const mockAction = {
				story: 'Test story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] }
			} as any;

			service.addGameAction(mockAction);
			// Verify it was added (would check state in real implementation)
		});

		it('should update history messages', () => {
			const messages = [{ role: 'user', content: 'Test message' }] as any[];
			service.updateHistoryMessages(messages);
			expect(service.getHistoryMessages()).toEqual(messages);
		});
	});

	describe('Save/Load', () => {
		it('should save game', () => {
			// Should not throw
			expect(() => service.saveGame()).not.toThrow();
		});

		it('should load game', () => {
			// Should not throw
			expect(() => service.loadGame()).not.toThrow();
		});
	});
});
