import type { Campaign, CampaignAgent } from "$lib/ai/agents/campaignAgent";
import { SLOW_STORY_PROMPT, type GameActionState } from "$lib/ai/agents/gameAgent";
import type { LLMMessage } from "$lib/ai/llm";
import type { Action } from "$lib/ai/agents/gameAgent";
import { stringifyPretty } from "$lib/util.svelte";
import type { Story } from '$lib/ai/agents/storyAgent';

export function mapPlotStringToIds(text: string, splitDelimeter: string = 'plotId: ') {
	if (!text) {
		return [0];
	}
	try {
		//allow reasoning to stay in the current plot point and trigger to get to the next
		const regex = new RegExp(`${splitDelimeter}(\\d+)`, 'g');
		let match;
		const plotIds: number[] = [];
		// Extract matches
		while ((match = regex.exec(text)) !== null) {
			plotIds.push(Number(match[1]));
		}
		return plotIds;
	} catch (e) {
		console.log('can not mapPlotStringToId', e);
		return [0];
	}
}

export async function advanceChapterIfApplicable(
	action: Action,
	newAdditionalStoryInput: string,
	didAIProcessAction: boolean,
	campaignState: Campaign,
	currentChapter: number,
	currentGameActionState: GameActionState,
	gameActionsState: GameActionState[],
	campaignAgent: CampaignAgent,
	historyMessages: LLMMessage[]
): Promise<{newAdditionalStoryInput: string, newChapter: boolean}> {
	let newChapter = false;
	if (
		didAIProcessAction &&
		campaignState.chapters &&
		campaignState.chapters[currentChapter - 1] &&
		!currentGameActionState.is_character_in_combat
	) {
		let campaignDeviations;
		if (gameActionsState.length % 5 === 0) {
			campaignDeviations = await campaignAgent.checkCampaignDeviations(
				action,
				campaignState,
				historyMessages
			);
			console.log(JSON.stringify(campaignDeviations, null, 2));
			if (campaignDeviations && campaignDeviations.deviation > 70) {
				newAdditionalStoryInput +=
					'\n' +
					campaignDeviations.plotNudge.nudgeExplanation +
					'\n' +
					campaignDeviations.plotNudge.nudgeStory +
					'Always describe the story as a Game Master and never mention meta elements such as plot points or story progression.';
			}
		}
		const mappedCurrentPlotPoint: number = mapPlotStringToIds(
			currentGameActionState.currentPlotPoint,
			'plotId: '
		)[0];
		const mappedCampaignChapterId: number = mapPlotStringToIds(
			campaignDeviations?.currentChapter || '',
			'chapterId: '
		)[0];
		if (
			mappedCurrentPlotPoint >
				campaignState.chapters[currentChapter - 1]?.plot_points?.length ||
			mappedCampaignChapterId > currentChapter
		) {
			newChapter = true;
		}
	}
	return {newAdditionalStoryInput, newChapter};
}

export function getNextChapterPrompt(
	campaign: Campaign,
	currentChapter: number,
	story: Story
): { prompt: string; updatedStory: Story } {
	// Create a snapshot of the campaign data and find the chapter matching the current chapter.
	const newChapter = campaign.chapters.find(
		(chapter) => chapter.chapterId === currentChapter
	);

	if (newChapter) {
		// Add first plot point from next chapter to determine when current chapter ends.
		// Note: We assume that campaign.chapters is indexed by chapterId.
		newChapter.plot_points.push({
			...campaign.chapters[newChapter.chapterId]?.plot_points[0],
			plotId: newChapter.plot_points.length + 1
		});

		const newChapterJson = stringifyPretty(newChapter);

		// Update the story with the new chapter's JSON.
		const updatedStory: Story = {
			...story,
			adventure_and_main_event: newChapterJson
		};

		return {
			prompt:
				'\nA new chapter begins, ' +
				SLOW_STORY_PROMPT +
				'\nSet currentPlotPoint to 1, nextPlotPoint to 2 and nudge the story into plotId 1: ' +
				'\n' +
				newChapterJson,
			updatedStory
		};
	}

	return {
		prompt:
			'\nNotify the players that the campaign has ended but they can continue with free exploration.',
		updatedStory: story
	};
} 