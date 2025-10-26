/**
 * AI Service
 * Coordinates AI agent instantiation and provides a facade for AI operations
 * Reduces complexity in the main component by centralizing AI agent management
 */

import { GameAgent } from '$lib/ai/agents/gameAgent';
import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
import { CharacterAgent } from '$lib/ai/agents/characterAgent';
import { CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
import { CombatAgent } from '$lib/ai/agents/combatAgent';
import { CampaignAgent } from '$lib/ai/agents/campaignAgent';
import { ActionAgent } from '$lib/ai/agents/actionAgent';
import { EventAgent } from '$lib/ai/agents/eventAgent';
import { ImagePromptAgent } from '$lib/ai/agents/imagePromptAgent';
import { LLMProvider } from '$lib/ai/llmProvider';
import type { AIConfig } from '$lib';
import type { SystemInstructionsState } from '$lib/ai/llm';

/**
 * Service for managing AI agents
 * Provides centralized initialization and access to all AI agents
 */
export class AIService {
	private gameAgent?: GameAgent;
	private summaryAgent?: SummaryAgent;
	private characterAgent?: CharacterAgent;
	private characterStatsAgent?: CharacterStatsAgent;
	private combatAgent?: CombatAgent;
	private campaignAgent?: CampaignAgent;
	private actionAgent?: ActionAgent;
	private eventAgent?: EventAgent;
	private imagePromptAgent?: ImagePromptAgent;

	private llmProvider?: LLMProvider;
	private apiKey: string = '';
	private temperature: number = 1.0;
	private systemInstructions?: SystemInstructionsState;
	private aiLanguage: string = 'English';

	/**
	 * Initialize the AI service with configuration
	 */
	initialize(config: {
		apiKey: string;
		temperature: number;
		systemInstructions: SystemInstructionsState;
		aiLanguage: string;
	}) {
		this.apiKey = config.apiKey;
		this.temperature = config.temperature;
		this.systemInstructions = config.systemInstructions;
		this.aiLanguage = config.aiLanguage;

		// Initialize LLM provider
		this.llmProvider = new LLMProvider(
			this.apiKey,
			this.temperature,
			this.aiLanguage
		);

		// Initialize all agents
		this.gameAgent = new GameAgent(this.llmProvider);
		this.summaryAgent = new SummaryAgent(this.llmProvider);
		this.characterAgent = new CharacterAgent(this.llmProvider);
		this.characterStatsAgent = new CharacterStatsAgent(this.llmProvider);
		this.combatAgent = new CombatAgent(this.llmProvider);
		this.campaignAgent = new CampaignAgent(this.llmProvider);
		this.actionAgent = new ActionAgent(this.llmProvider);
		this.eventAgent = new EventAgent(this.llmProvider);
		this.imagePromptAgent = new ImagePromptAgent(this.llmProvider);
	}

	/**
	 * Get the game agent
	 */
	getGameAgent(): GameAgent {
		if (!this.gameAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.gameAgent;
	}

	/**
	 * Get the summary agent
	 */
	getSummaryAgent(): SummaryAgent {
		if (!this.summaryAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.summaryAgent;
	}

	/**
	 * Get the character agent
	 */
	getCharacterAgent(): CharacterAgent {
		if (!this.characterAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.characterAgent;
	}

	/**
	 * Get the character stats agent
	 */
	getCharacterStatsAgent(): CharacterStatsAgent {
		if (!this.characterStatsAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.characterStatsAgent;
	}

	/**
	 * Get the combat agent
	 */
	getCombatAgent(): CombatAgent {
		if (!this.combatAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.combatAgent;
	}

	/**
	 * Get the campaign agent
	 */
	getCampaignAgent(): CampaignAgent {
		if (!this.campaignAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.campaignAgent;
	}

	/**
	 * Get the action agent
	 */
	getActionAgent(): ActionAgent {
		if (!this.actionAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.actionAgent;
	}

	/**
	 * Get the event agent
	 */
	getEventAgent(): EventAgent {
		if (!this.eventAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.eventAgent;
	}

	/**
	 * Get the image prompt agent
	 */
	getImagePromptAgent(): ImagePromptAgent {
		if (!this.imagePromptAgent) {
			throw new Error('AI Service not initialized. Call initialize() first.');
		}
		return this.imagePromptAgent;
	}

	/**
	 * Check if service is initialized
	 */
	isInitialized(): boolean {
		return !!this.gameAgent;
	}

	/**
	 * Update API key and reinitialize agents
	 */
	updateApiKey(apiKey: string) {
		this.apiKey = apiKey;
		if (this.isInitialized() && this.systemInstructions) {
			this.initialize({
				apiKey,
				temperature: this.temperature,
				systemInstructions: this.systemInstructions,
				aiLanguage: this.aiLanguage
			});
		}
	}

	/**
	 * Update temperature and reinitialize agents
	 */
	updateTemperature(temperature: number) {
		this.temperature = temperature;
		if (this.isInitialized() && this.systemInstructions) {
			this.initialize({
				apiKey: this.apiKey,
				temperature,
				systemInstructions: this.systemInstructions,
				aiLanguage: this.aiLanguage
			});
		}
	}
}

/**
 * Create and export a singleton AI service instance
 */
export const aiService = new AIService();
