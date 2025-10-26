import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { SummaryAgent, RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import type { Action } from '$lib/ai/agents/gameAgent';

// Simple in-memory cache for related history lookups.
// Keyed by a stable string of the relevant inputs.
// Values cached as array of strings (resolved result).
// We also keep a pending promise map to avoid duplicate concurrent LLM calls.
const relatedHistoryCache = new Map<string, string[]>();
const pendingCache = new Map<string, Promise<string[]>>();

// Evict oldest 20 entries when size grows beyond 30
function pruneCache() {
	const MAX_SIZE = 30;
	const REMOVE_COUNT = 20;
	if (relatedHistoryCache.size > MAX_SIZE) {
		let removed = 0;
		for (const key of relatedHistoryCache.keys()) {
			relatedHistoryCache.delete(key);
			removed++;
			if (removed >= REMOVE_COUNT) break;
		}
	}
}

interface CacheKeyParts {
	customMemories?: string;
	actionText?: string;
	gameActionsLength?: number;
	relatedStoryDetailsLength?: number;
	summaryAgentTag?: string; // distinguishes different agent instances
}

const buildCacheKey = (parts: CacheKeyParts): string => {
	return JSON.stringify(parts);
};

export const getRelatedHistory = async (
	summaryAgent?: SummaryAgent,
	action?: Action,
	gameActions?: GameActionState[],
	relatedStoryHistoryState?: RelatedStoryHistory,
	customMemories?: string
) => {
	const key = buildCacheKey({
		customMemories,
		actionText: action?.text,
		gameActionsLength: gameActions?.length,
		relatedStoryDetailsLength: relatedStoryHistoryState?.relatedDetails?.length,
		summaryAgentTag: summaryAgent ? String((summaryAgent as any)._agentId || 'default') : 'none'
	});

	if (relatedHistoryCache.has(key)) {
		return relatedHistoryCache.get(key)!;
	}

	if (pendingCache.has(key)) {
		return pendingCache.get(key)!;
	}

	const computationPromise: Promise<string[]> = (async () => {
		const relatedHistoryWithRelevance: RelatedStoryHistory = { relatedDetails: [] };
		if (customMemories) {
			relatedHistoryWithRelevance.relatedDetails.push({
				storyReference: customMemories,
				relevanceScore: 2
			});
		}
		relatedHistoryWithRelevance.relatedDetails.push(
			...(relatedStoryHistoryState?.relatedDetails || [])
		);
		if (summaryAgent && action && action.text !== 'Continue The Tale') {
			try {
				const retrieved = await summaryAgent.retrieveRelatedHistory(action.text, gameActions || []);
				relatedHistoryWithRelevance.relatedDetails.push(...retrieved.relatedDetails);
			} catch (e) {
				console.warn('retrieveRelatedHistory failed', e);
			}
		}
		const relatedHistory = [
			...new Set(
				relatedHistoryWithRelevance.relatedDetails
					.filter((detail) => detail.relevanceScore >= 0.7)
					.sort((a, b) => b.relevanceScore - a.relevanceScore)
					.map((detail) => detail.storyReference)
			)
		];
		relatedHistoryCache.set(key, relatedHistory);
		pruneCache();
		pendingCache.delete(key);
		return relatedHistory;
	})();

	pendingCache.set(key, computationPromise);
	return computationPromise;
};
