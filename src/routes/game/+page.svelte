<script lang="ts">
	import DiceBox from '@3d-dice/dice-box';
	import { onMount, tick } from 'svelte';
	import { DynamicGameAgent, gameStateRules, systemBehaviour } from '$lib/ai/agents/dynamicGameAgent';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import type { LLMMessage } from '$lib/ai/llm';
	import { UIAgent, uiFeatureInstructions, uiTechnicalInstructions } from '$lib/ai/agents/uiAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { errorState } from '$lib/state/errorState.svelte';
	import ErrorModal from '$lib/components/interaction_modals/ErrorModal.svelte';
	import isEqual from 'lodash.isequal';
	import { handleError, stringifyPretty } from '$lib/util.svelte';
	import GMQuestionModal from '$lib/components/interaction_modals/GMQuestionModal.svelte';

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const temperatureState = useLocalStorage<number>('temperatureState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState', []);

	let loadingText = $state('Asking the Game Master');
	const customActionReceiver = useLocalStorage<'Ingame Command' | 'Character Action' | 'UI Command' | 'Game State Command' | 'GM Question'>('customActionReceiver', 'Character Action');
	let isAiGeneratingState = $state(false);
	let customActionInput = $state('');
	let gmQuestionState: string = $state('');

	const dynamicStoryState = useLocalStorage<string>('dynamicStoryState');
	const dynamicGameState = useLocalStorage<any>('dynamicGameState');
	let uiData = useLocalStorage('uiData', { html: '', css: '', javascript: '' });
	const gameMasterInstructionsState = useLocalStorage<{
		systemBehaviour,
		gameStateRules
	}>('gameMasterInstructionsState', { systemBehaviour, gameStateRules });

	const uiTempContext = useLocalStorage<string[]>('uiTempContext', []);
	const gameStateTempContext = useLocalStorage<string[]>('gameStateTempContext', []);

	const uiInstructionsState = useLocalStorage<{
		uiFeatureInstructions,
		uiTechnicalInstructions
	}>('uiInstructionsState', { uiFeatureInstructions, uiTechnicalInstructions });

	let gameAgent: DynamicGameAgent;
	let uiAgent: UIAgent;

	function renderUI() {
		// Inject CSS
		if (uiData.value?.css) {
			let style = document.createElement('style');
			style.innerHTML = uiData.value.css;
			document.head.appendChild(style);
		}

		// Inject JavaScript
		if (uiData.value?.javascript) {
			let script = document.createElement('script');
			script.innerHTML = 'try{ ' + uiData.value.javascript + '}catch(e){window.setErrorState(e);}';
			document.body.appendChild(script);
		}
	}

	function compareObjectKeys(oldObj, newObj) {
		const getKeys = (obj, keys = new Set()) => {
			for (let key in obj) {
				keys.add(key);
				if (typeof obj[key] === 'object' && obj[key] !== null) {
					getKeys(obj[key], keys);
				}
			}
			return keys;
		};

		const oldKeys = getKeys(oldObj);
		const newKeys = getKeys(newObj);

		//parse number to not include array indices
		const addedKeys = [...newKeys].filter(key => isNaN(Number.parseInt(key))).filter(key => !oldKeys.has(key));
		const removedKeys = [...oldKeys].filter(key => isNaN(Number.parseInt(key))).filter(key => !newKeys.has(key));

		console.log('addedKeys', addedKeys);
		console.log('removedKeys', removedKeys);
		const areSame = addedKeys.length === 0 && removedKeys.length === 0;
		if (!areSame) {
			debugger;
		}
		return { areSame, addedKeys, removedKeys };
	}

	const updateGameStateAndUI = async (characterAction: string, gameMasterHints?: any, contextualInfo?: any) => {
		isAiGeneratingState = true;
		const storyProgression = await gameAgent.sendToGameMasterToGenerateNextGameState(characterAction, dynamicStoryState.value,
			historyMessagesState.value, gameMasterHints, contextualInfo, gameStateTempContext.value, gameMasterInstructionsState.value);
		if (storyProgression?.newState) {
			console.log(stringifyPretty(storyProgression.newState));
			const oldState = $state.snapshot(dynamicGameState.value);
			dynamicGameState.value = storyProgression.newState;
			historyMessagesState.value = storyProgression.updatedHistoryMessages;
			window.gameState = storyProgression.newState;

			if (!compareObjectKeys(oldState, storyProgression.newState).areSame) {
				await generateUIData();
			} else {
				window.location.reload();
			}
			isAiGeneratingState = false;
		}
	};

	const onCustomActionSubmitted = async () => {
		const input = $state.snapshot(customActionInput);
		if (customActionReceiver.value === 'Character Action') {
			await updateGameStateAndUI(input);
		}
		if (customActionReceiver.value === 'GM Question') {
			gmQuestionState = input;
		}
		if (customActionReceiver.value === 'Ingame Command') {
			await updateGameStateAndUI(input, 'sudo: Ignore the rules and play out this action even if it should not be possible!');
		}
		if (customActionReceiver.value === 'Game State Command') {
			gameStateTempContext.value = [...gameStateTempContext.value, input];
			await updateGameStateAndUI('Only update the game state, but do not progress the story from this request');
		}
		if (customActionReceiver.value === 'UI Command') {
			uiTempContext.value = [...uiTempContext.value, input];
			await generateUIData(true);
		}
		customActionInput = '';
	};
	const onGMQuestionClosed = (closedByPlayer: boolean) => {
		if (closedByPlayer) {
			customActionInput = '';
		}
		gmQuestionState = '';
	};

	const generateUIData = async (createFromCurrentUI: boolean) => {
		isAiGeneratingState = true;
		loadingText = 'Generating the UI';
		uiData.value = await uiAgent.regenerateUIForGameState(dynamicGameState.value, dynamicStoryState.value,
			uiInstructionsState.value, uiTempContext.value, createFromCurrentUI ? uiData.value : undefined);
		isAiGeneratingState = false;
		if (uiData.value) {
			window.location.reload();
		}
	};

	const _onMount = async () => {
		if (!dynamicGameState.value || isEqual(dynamicGameState.value, {})) {
			await updateGameStateAndUI(gameAgent.getStartingPrompt());
		} else {
			if (!uiData.value?.html) {
				await generateUIData();
			}
		}
	};

	let diceBox;
	onMount(async () => {
		window.gameState = dynamicGameState.value;
		window.setErrorState = (e) => handleError(e);

		diceBox = new DiceBox('#dice-box', {
			assetPath: '/assets/dice-box/' // required
		});
		await diceBox.init();
		const llm = LLMProvider.provideLLM({
			temperature: temperatureState.value,
			language: aiLanguage.value,
			apiKey: apiKeyState.value
		});
		gameAgent = new DynamicGameAgent(llm);
		const technicalLLM = LLMProvider.provideLLM({
			temperature: 0.5,
			language: aiLanguage.value,
			apiKey: apiKeyState.value
		});
		uiAgent = new UIAgent(technicalLLM);

		window.sendToGameMasterToGenerateNextGameState =
			async (characterAction: string, gameMasterHints: any, contextualInfo: any) => {
				diceBox.clear();
				await updateGameStateAndUI(characterAction, gameMasterHints, contextualInfo);
			};

		window.roll1D20andGetResultAsNumber =
			async () => (await diceBox.roll('1d20'))[0].value;

		await _onMount();
		if (uiData.value?.html) {
			await tick();
			renderUI();
		}
	});
</script>
<div id="dice-box" class="pointer-events-none fixed inset-0 z-[1000]"></div>
<div id="game-container" class="container mx-auto p-4">
	{#if errorState.userMessage}
		<ErrorModal onclose={async (error) => {
			isAiGeneratingState = false;
			if(error){
				let errorObj;
				try{
					errorObj = JSON.parse(error);
				}catch (e){
					console.log(e);
				}
				uiTempContext.value = [...uiTempContext.value, 'Try to fix this error: ' + (errorObj?.event || error)];
				await generateUIData(true);
			}
		}} />
	{/if}
	{#if gmQuestionState}
		<GMQuestionModal onclose={onGMQuestionClosed} question={gmQuestionState}
										 playerCharactersGameState={dynamicGameState.value} />
	{/if}
	{#if isAiGeneratingState}
		<LoadingModal {loadingText}></LoadingModal>
	{:else}
		{@html uiData?.value.html}
	{/if}


	<div id="static-actions" class="p-4 pb-0 pt-0">

		<button
			onclick={() => updateGameStateAndUI('Continue The Tale')}
			class="text-md btn btn-neutral mb-3 w-full"
		>Continue The Tale.
		</button>
		<button
			type="submit"
			onclick={generateUIData}
			class="btn btn-neutral w-full mb-3"
		>Regenerate UI
		</button>
		<form id="input-form" class="p-4 pb-2">
			<div class="lg:join w-full">
				<select bind:value={customActionReceiver.value} class="select select-bordered w-full lg:w-fit">
					<option selected>Character Action</option>
					<option>GM Question</option>
					<option>Ingame Command</option>
					<option>UI Command</option>
					<option>Game State Command</option>
				</select>
				<input
					type="text"
					bind:value={customActionInput}
					class="input input-bordered w-full"
					id="user-input"
					placeholder={customActionReceiver.value === 'Character Action'
							? 'What are you up to?'
							: customActionReceiver.value === 'UI Command'
								? 'Command for UI elements or try to fix bug'
								: customActionReceiver.value === 'GM Question' ?
								'Message to the Game Master'
								: customActionReceiver.value === 'Game State Command' ?
									'Command to add or remove variables in game state'
								: 'Command for the Game Master without restrictions'}
				/>
				<button
					type="submit"
					onclick={onCustomActionSubmitted}
					class="btn btn-neutral w-full lg:w-1/4"
					id="submit-button"
				>Submit
				</button>
			</div>
		</form>

	</div>
</div>