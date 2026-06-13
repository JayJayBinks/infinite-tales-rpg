import { describe, expect, it } from 'vitest';
import {
	buildLocalActionPromptView,
	buildLocalStoryPromptView,
	compactHistoryMessages,
	promptViewToRequestMetadata
} from '$lib/ai/localPromptViews';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import type { GameActionState, InventoryState } from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

const story: Story = {
	game: 'Test RPG',
	world_details: 'A compact test world',
	adventure_and_main_event: 'A long secret adventure',
	character_simple_description: 'A hero',
	general_image_prompt: 'fantasy',
	theme: 'Mystery',
	tonality: 'Tense'
};

const currentGameState: GameActionState = {
	id: 1,
	currentPlotPoint: 'PLOT_ID: 1',
	nextPlotPoint: 'PLOT_ID: 2',
	story: 'The hero sees a locked iron door and a silver keyhole.',
	image_prompt: '',
	inventory_update: [],
	stats_update: [],
	is_character_in_combat: false,
	currently_present_npcs: { hostile: [], friendly: [], neutral: [] },
	story_memory_explanation: 'LOW'
};

const characterStats: CharacterStats = {
	level: 1,
	resources: { HP: { max_value: 20, start_value: 20, game_ends_when_zero: true } },
	attributes: { Dexterity: 2 },
	skills: { Lockpicking: 3 },
	spells_and_abilities: [
		{
			name: 'Fireball',
			effect: 'Burns enemies',
			resource_cost: { cost: 1, resource_key: 'MP' },
			image_prompt: ''
		},
		{
			name: 'Open Lock',
			effect: 'Helps with locked doors and keyholes',
			resource_cost: { cost: 0, resource_key: undefined },
			image_prompt: ''
		}
	]
};

describe('local prompt views', () => {
	it('keeps only recent history turns and trims long messages', () => {
		const history = Array.from({ length: 10 }, (_, index) => ({
			role: index % 2 === 0 ? ('user' as const) : ('model' as const),
			content: `message ${index} ${'x'.repeat(3000)}`
		}));

		const compacted = compactHistoryMessages(history, 2, 100);

		expect(compacted).toHaveLength(4);
		expect(compacted[0].content).toContain('message 6');
		expect(compacted[0].content.length).toBeLessThan(160);
	});

	it('reduces action prompt inventory and keeps relevant items', () => {
		const inventory: InventoryState = Object.fromEntries(
			Array.from({ length: 12 }, (_, index) => [
				`item_${index}`,
				{ description: `generic item ${index}`, effect: 'minor effect' }
			])
		);
		inventory.silver_key = {
			description: 'A silver key for an iron door',
			effect: 'Opens locked keyholes'
		};

		const view = buildLocalActionPromptView({
			currentGameState,
			historyMessages: [],
			storySettings: story,
			characterDescription: { name: 'Ada', appearance: 'Focused' } as any,
			characterStats,
			inventoryState: inventory,
			actionText: 'Open the locked iron door with the silver key'
		});

		expect(Object.keys(view.inventoryState)).toContain('silver_key');
		expect(Object.keys(view.inventoryState).length).toBeLessThan(Object.keys(inventory).length);
		expect(view.debug.reductions.some((entry) => entry.includes('inventory items'))).toBe(true);
	});

	it('creates request debug metadata from story prompt view', () => {
		const longHistory = Array.from({ length: 8 }, (_, index) => ({
			role: index % 2 === 0 ? ('user' as const) : ('model' as const),
			content: `old history ${index} ${'x'.repeat(3000)}`
		}));
		const view = buildLocalStoryPromptView({
			actionText: 'Search the library',
			storyState: story,
			characterState: { name: 'Ada', appearance: 'Investigator' } as any,
			playerCharactersGameState: {
				HP: { max_value: 20, current_value: 20, game_ends_when_zero: true }
			},
			inventoryState: {},
			historyMessages: longHistory,
			relatedHistory: ['A previous clue points to the library.']
		});

		expect(promptViewToRequestMetadata(view.debug)).toMatchObject({
			promptViewType: 'story'
		});
		expect(view.debug.preview).toContain('Search the library');
		expect(view.debug.preview).not.toContain('old history 0');
	});
});
