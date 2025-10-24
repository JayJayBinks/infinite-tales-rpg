<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import type {
		CharacterStats,
		SkillsProgression,
		PartyStats
	} from '$lib/ai/agents/characterStatsAgent.ts';
	import type { CharacterDescription, Party } from '$lib/ai/agents/characterAgent';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import type { AIConfig } from '$lib';
	import { getRequiredSkillProgression } from '../characterLogic';
	import PartyMemberSwitcher from '$lib/components/PartyMemberSwitcher.svelte';
	import { getActivePartyMember, getActivePartyMemberStats } from '../partyLogic';

	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const characterStatsState = useLocalStorage<CharacterStats>('characterStatsState');
	const partyState = useLocalStorage<Party>('partyState');
	const partyStatsState = useLocalStorage<PartyStats>('partyStatsState');
	const skillsProgressionState = useLocalStorage<Record<string, SkillsProgression>>(
		'skillsProgressionByMemberState',
		{}
	);
	const storyState = useLocalStorage<Story>('storyState');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	// Sync character state when active party member changes
	$effect(() => {
		if (partyState.value.members.length > 0) {
			const activeMember = getActivePartyMember(partyState.value);
			const activeMemberStats = getActivePartyMemberStats(partyState.value, partyStatsState.value);
			if (activeMember && activeMemberStats) {
				characterState.value = activeMember.character;
				characterStatsState.value = activeMemberStats;
			}
		}
	});

	// Get current member skills
	const currentMemberSkills = $derived(
		partyState.value.activeCharacterId
			? skillsProgressionState.value[partyState.value.activeCharacterId] || {}
			: {}
	);
</script>

{#if characterState.value}
	<div
		class="menu-content mt-4 flex min-h-screen flex-col items-center justify-center p-4 text-center"
		id="stats"
	>
		<!-- Party Switcher -->
		{#if partyState.value.members.length > 1}
			<div class="mb-4">
				<PartyMemberSwitcher
					party={partyState.value}
					onSwitch={() => {
						// Character state is automatically synced via $effect in main game
					}}
				/>
			</div>
		{/if}

		<div class="character-profile w-full max-w-lg rounded-lg text-white shadow-lg">
			<h1 id="name" class="class mb-4 border-b border-gray-600 text-center text-3xl font-bold">
				{characterState.value.name}
			</h1>
			{#if !aiConfigState.value?.disableImagesState}
				<div class="m-auto flex w-full flex-col">
					<AIGeneratedImage
						storageKey="characterImageState"
						imagePrompt="{storyState.value.general_image_prompt} {characterState.value.appearance}"
					></AIGeneratedImage>
				</div>
			{/if}
			<div class="section mb-6">
				<h2 class="mb-2 mt-2 border-b border-gray-600 pb-1 text-xl font-semibold">
					Basic Information
				</h2>
				<div class="flex flex-col space-y-1 text-start">
					<p><strong>Race:</strong> <span id="race">{characterState.value.race}</span></p>
					<p><strong>Gender:</strong> <span id="gender">{characterState.value.gender}</span></p>
					<p><strong>Class:</strong> <span id="class">{characterState.value.class}</span></p>
					<p><strong>Level:</strong> <span id="class">{characterStatsState.value.level}</span></p>
					{#each Object.entries(characterStatsState.value.resources || {}) as [resourceKey, resourceValue] (resourceKey)}
						<output class="capitalize">
							Max. {resourceKey.replaceAll('_', ' ')}: {resourceValue.max_value}
						</output>
					{/each}
					<p>
						<strong>Alignment:</strong> <span id="alignment">{characterState.value.alignment}</span>
					</p>
					<p>
						<strong>Background:</strong>
						<span id="background">{characterState.value.background}</span>
					</p>
				</div>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Appearance</h2>
				<p id="appearance">{characterState.value.appearance}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Personality</h2>
				<p id="personality">{characterState.value.personality}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Motivation</h2>
				<p id="motivation">{characterState.value.motivation}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Attributes</h2>
				<ul id="attributes" class="class list-inside items-center justify-center">
					{#each Object.entries(characterStatsState.value.attributes || {}) as [attributeName, attributeValue] (attributeName)}
						<li class="mt-3 flex flex-col">
							<strong class="m-auto w-full text-center capitalize"
								>{attributeName.replace(/_/g, ' ')}: {attributeValue}</strong
							>
						</li>
					{/each}
				</ul>
			</div>
			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Skills</h2>
				<ul id="skills" class="class list-inside items-center justify-center">
					{#each Object.entries(characterStatsState.value.skills || {}) as [skillName, skillValue] (skillName)}
						<li class="mt-3 flex flex-col">
							<strong class="m-auto w-full text-center capitalize"
								>{skillName.replace(/_/g, ' ')}: {skillValue}</strong
							>
							<div class="flex w-full">
								<small class="mr-auto">
									{currentMemberSkills[skillName] || 0}
								</small>
								<small class="ml-auto">
									{getRequiredSkillProgression(skillName, characterStatsState.value)}
								</small>
							</div>
							<progress
								class="progress progress-success w-full"
								value={currentMemberSkills[skillName] || -1}
								max={getRequiredSkillProgression(skillName, characterStatsState.value) || -1}
							></progress>
						</li>
					{/each}
				</ul>
			</div>
			<!-- Party Switcher -->
			{#if partyState.value.members.length > 1}
				<div class="mb-4">
					<PartyMemberSwitcher
						party={partyState.value}
						onSwitch={() => {
							// Character state is automatically synced via $effect in main game
						}}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}
