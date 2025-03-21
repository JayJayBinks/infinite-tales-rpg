import type { Campaign, CampaignAgent, CampaignChapter } from '$lib/ai/agents/campaignAgent';
import type { Action } from '$lib/ai/agents/gameAgent';
import { type GameActionState, SLOW_STORY_PROMPT } from '$lib/ai/agents/gameAgent';
import type { LLMMessage } from '$lib/ai/llm';
import { stringifyPretty } from '$lib/util.svelte';
import type { Story } from '$lib/ai/agents/storyAgent';

export function mapPlotStringToIds(text: string, splitDelimeter: string = 'PLOT_ID: ') {
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
): Promise<{ newAdditionalStoryInput: string; newChapter: boolean }> {
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
			//TODO disabled for now as it tries to reintroduce the campaign plot, lets see if memory system can handle this better
			if (campaignDeviations && campaignDeviations.deviation > 150) {
				// > 70
				newAdditionalStoryInput +=
					'\n' +
					campaignDeviations.plotNudge.nudgeExplanation +
					'\n' +
					campaignDeviations.plotNudge.nudgeStory +
					'\n\nAlways describe the story as a Game Master and never mention meta elements such as plot points or story progression.\n\n';
			}
		}
		const mappedCurrentPlotPoint: number = mapPlotStringToIds(
			currentGameActionState.currentPlotPoint,
			'PLOT_ID: '
		)[0];
		const mappedCampaignChapterId: number = mapPlotStringToIds(
			campaignDeviations?.currentChapter || '',
			'CHAPTER_ID: '
		)[0];
		if (
			mappedCurrentPlotPoint > campaignState.chapters[currentChapter - 1]?.plot_points?.length ||
			mappedCampaignChapterId > currentChapter
		) {
			newChapter = true;
		}
	}
	return { newAdditionalStoryInput, newChapter };
}

export function getGameMasterNotesForCampaignChapter(
	campaignChapter?: CampaignChapter,
	currentPlotPointString?: string
): Array<string> {
	if (campaignChapter && currentPlotPointString) {
		const mappedPlotPoint = mapPlotStringToIds(currentPlotPointString)[0];
		if (mappedPlotPoint > 0) {
			return [campaignChapter.plot_points.find((p) => p.plotId === mappedPlotPoint)
				?.game_master_notes].flat() as Array<string> || []
		}
	}
	return [];
}

export function getNextChapterPrompt(
	campaign: Campaign,
	currentChapter: number,
	story: Story
): { prompt: string; updatedStory: Story } {
	// Create a snapshot of the campaign data and find the chapter matching the current chapter.
	const newChapter = campaign.chapters.find((chapter) => chapter.chapterId === currentChapter);

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
