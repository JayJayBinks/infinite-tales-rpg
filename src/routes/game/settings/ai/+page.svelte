<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { navigate, parseState, playAudioFromStream } from '$lib/util.svelte';
	import { CharacterAgent, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { initialStoryState, StoryAgent } from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { goto } from '$app/navigation';
	import { CharacterStatsAgent, initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
	import { initialCampaignState } from '$lib/ai/agents/campaignAgent';
	import type { Voice } from 'msedge-tts';
	import { onMount } from 'svelte';
	import type { AIConfig } from '$lib';

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const temperatureState = useLocalStorage<number>('temperatureState', 1.3);
	const customSystemInstruction = useLocalStorage<string>('customSystemInstruction');
	const aiLanguage = useLocalStorage<string>('aiLanguage');

	//TODO migrate all AI settings into this object to avoid too many vars in local storage
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState', {
		disableAudioState: false,
		disableImagesState: false
	});

	const gameActionsState = useLocalStorage('gameActionsState', []);
	const historyMessagesState = useLocalStorage('historyMessagesState', []);
	const characterState = useLocalStorage('characterState', initialCharacterState);
	const inventoryState = useLocalStorage('inventoryState', {});
	const characterImageState = useLocalStorage('characterImageState');
	const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
	const npcState = useLocalStorage('npcState', []);
	const storyState = useLocalStorage('storyState', initialStoryState);
	const isGameEnded = useLocalStorage('isGameEnded', false);
	const rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
	const campaignState = useLocalStorage('campaignState', initialCampaignState);
	const currentChapterState = useLocalStorage('currentChapterState');
	const characterActionsState = useLocalStorage('characterActionsState');
	let levelUpState = useLocalStorage('levelUpState');

	const dynamicGameState = useLocalStorage<any>('dynamicGameState');
	let uiData = useLocalStorage('uiData', { html: '', css: '', javascript: '' });
	const uiTempContext = useLocalStorage<string[]>('uiTempContext', []);
	const gameStateTempContext = useLocalStorage<string[]>('gameStateTempContext', []);

	const ttsVoiceState = useLocalStorage<string>('ttsVoice');
	let ttsVoices: Voice[] = $state([]);
	let isGeneratingState = $state(false);

	onMount(async () => {
		ttsVoices = (await (await fetch('/api/edgeTTSStream/voices')).json()).sort((a, b) =>
			a.Locale === b.Locale ? 0 : a.Locale.includes(navigator.language) ? -1 : 1
		);
	});

	function clearStates() {
		historyMessagesState.reset();
		gameActionsState.reset();
		characterState.reset();
		characterImageState.reset();
		characterStatsState.reset();
		storyState.reset();
		isGameEnded.reset();
		rollDifferenceHistoryState.reset();
		npcState.reset();
		inventoryState.reset();
		campaignState.reset();
		currentChapterState.reset();
		characterActionsState.reset();
		levelUpState.reset();

		dynamicGameState.reset();
		uiData.reset();
		uiTempContext.reset();
		gameStateTempContext.reset();
	}

	async function onQuickstartNew() {
		clearStates();
		const llm = LLMProvider.provideLLM({
			temperature: 2,
			apiKey: apiKeyState.value,
			language: aiLanguage.value
		});
		const storyAgent = new StoryAgent(llm);
		isGeneratingState = true;
		const newStoryState = await storyAgent.generateRandomStorySettings();
		if (newStoryState) {
			storyState.value = newStoryState;
			const characterAgent = new CharacterAgent(llm);
			const newCharacterState = await characterAgent.generateCharacterDescription(
				$state.snapshot(storyState.value)
			);
			if (newCharacterState) {
				characterState.value = newCharacterState;
				const characterStatsAgent = new CharacterStatsAgent(llm);
				const newCharacterStatsState = await characterStatsAgent.generateCharacterStats(
					storyState.value,
					characterState.value
				);
				parseState(newCharacterStatsState);
				if (newCharacterState) {
					characterStatsState.value = newCharacterStatsState;
					await goto('/game');
				}
			}
		}
		isGeneratingState = false;
	}

	function onStartCustom() {
		clearStates();
		navigate('/new/tale');
	}

	function onNewCampaign() {
		clearStates();
		navigate('/new/campaign');
	}
</script>

{#if isGeneratingState}
	<LoadingModal loadingText="Creating Your New Tale..." />
{/if}
<form class="m-6 flex flex-col items-center text-center">
	<label class="form-control w-full sm:w-2/3">
		<p>Google Gemini API Key</p>
		<input
			type="text"
			id="apikey"
			bind:value={apiKeyState.value}
			placeholder="Copy your API Key from Google AI Studio and paste here"
			class="input input-bordered mt-2"
		/>
		<small class="m-auto mt-2"
		>View the
			<a
				target="_blank"
				href="https://github.com/JayJayBinks/infinite-tales-rpg/wiki/Create-your-free-Google-Gemini-API-Key-%F0%9F%94%91"
				class="link text-blue-400 underline"
			>
				guide to create the API Key</a
			></small
		>
	</label>

	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		disabled={!apiKeyState.value}
		onclick={onStartCustom}
	>
		New Custom Tale
	</button>

	<div class="divider mt-7">Advanced Settings</div>

	<label class="form-control mt-3 w-full sm:w-2/3">
		AI Language
		<input
			bind:value={aiLanguage.value}
			placeholder="AI will respond in this language, leave empty for English"
			class="input input-bordered mt-2"
		/>
		<small class="m-auto mt-2">The Game UI will not be translated yet</small>
	</label>

	<label class="form-control mt-5 w-full sm:w-2/3">
		Temperature: {temperatureState.value}
		<input
			type="range"
			min="0"
			max="2"
			step="0.05"
			id="temperature"
			bind:value={temperatureState.value}
			class="range mt-2"
		/>
		<small class="m-auto mt-2"
		>Higher temperature makes the AI more creative, but also errors more likely</small
		>
	</label>


</form>
