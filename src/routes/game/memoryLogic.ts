import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { SummaryAgent, RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import { stringifyPretty } from '$lib/util.svelte';
import type { Action } from '$lib/ai/agents/gameAgent';

export const getRelatedHistory = async (
	action: Action,
	gameActions: GameActionState[],
	summaryAgent: SummaryAgent,
	relatedStoryHistoryState?: RelatedStoryHistory
) => {
	let relatedHistory: string[] = [];
	const relatedHistoryWithRelevance: RelatedStoryHistory = { relatedDetails: [] };
	relatedHistoryWithRelevance.relatedDetails.push(
		...(relatedStoryHistoryState?.relatedDetails || [])
	);
	if (action.text != 'Continue The Tale') {
		relatedHistoryWithRelevance.relatedDetails.push(
			...(await summaryAgent.retrieveRelatedHistory(action.text, gameActions)).relatedDetails
		);
	}
	relatedHistory = [
		...new Set(
			relatedHistoryWithRelevance.relatedDetails
				.filter((detail) => detail.relevanceScore >= 0.7)
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.map((detail) => detail.storyReference)
		)
	];
	return relatedHistory;
};