<script lang="ts">
	import type { Party } from '$lib/ai/agents/characterAgent';
	import type { PartyStats } from '$lib/ai/agents/characterStatsAgent';
	import { switchActiveCharacter } from '../../../routes/game/partyLogic';

	let {
		party,
		partyStats,
		onSwitch
	}: {
		party: Party;
		partyStats: PartyStats;
		onSwitch?: () => void;
	} = $props();

	function handleSwitch(memberId: string) {
		switchActiveCharacter(party, memberId);
		onSwitch?.();
	}
</script>

{#if party && party.members.length > 1}
	<div class="party-switcher flex flex-wrap justify-center gap-2 mb-4">
		{#each party.members as member}
			{@const memberStats = partyStats.members.find((m) => m.id === member.id)?.stats}
			{@const isActive = party.activeCharacterId === member.id}
			<button
				class="btn btn-sm"
				class:btn-primary={isActive}
				class:btn-outline={!isActive}
				onclick={() => handleSwitch(member.id)}
				title={member.character.class || 'No class'}
			>
				<div class="flex flex-col items-start">
					<span class="font-bold">{member.character.name || `Character ${member.id.split('_').pop()}`}</span>
					{#if memberStats}
						{@const criticalResource = Object.entries(memberStats.resources).find(
							([_, r]) => r.game_ends_when_zero
						)}
						{#if criticalResource}
							{@const [resourceKey, resource] = criticalResource}
							<span class="text-xs">
								{resourceKey}: {resource.start_value}/{resource.max_value}
							</span>
						{/if}
					{/if}
				</div>
			</button>
		{/each}
	</div>
{/if}

<style>
	.party-switcher {
		padding: 0.5rem;
		background: var(--base-200, #f3f4f6);
		border-radius: 0.5rem;
	}
</style>
