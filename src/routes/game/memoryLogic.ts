import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { SummaryAgent, RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import type { Action } from '$lib/ai/agents/gameAgent';

export const getRelatedHistory = async (
	summaryAgent: SummaryAgent,
	action?: Action,
	gameActions?: GameActionState[],
	relatedStoryHistoryState?: RelatedStoryHistory,
	customMemories?: string
) => {
	let relatedHistory: string[] = [];
	const relatedHistoryWithRelevance: RelatedStoryHistory = { relatedDetails: [] };
	if (customMemories) {
		relatedHistoryWithRelevance.relatedDetails.push({
			storyReference: customMemories,
			relevanceScore: 2 //overrules other memories if conflicting
		});
	}
	relatedHistoryWithRelevance.relatedDetails.push(
		...(relatedStoryHistoryState?.relatedDetails || [])
	);
	if (action && action.text != 'Continue The Tale') {
		relatedHistoryWithRelevance.relatedDetails.push(
			...(await summaryAgent.retrieveRelatedHistory(action.text, gameActions || [])).relatedDetails
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
