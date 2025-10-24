<script lang="ts">
	import type { Party } from '$lib/ai/agents/characterAgent';
	import { switchActiveCharacter } from '../../routes/game/partyLogic';

	let {
		party,
		onSwitch
	}: {
		party: Party;
		onSwitch?: () => void;
	} = $props();

	function handleSwitch(memberId: string) {
		switchActiveCharacter(party, memberId);
		onSwitch?.();
	}
</script>

{#if party && party.members.length > 1}
	<div class="party-switcher mb-4 flex flex-wrap justify-center gap-2">
		{#each party.members as member}
			{@const isActive = party.activeCharacterId === member.id}
			<button
				class="btn btn-sm w-1/3"
				class:btn-primary={isActive}
				class:btn-outline={!isActive}
				onclick={() => handleSwitch(member.id)}
				title={member.character.class || 'No class'}
			>
				<div class="flex flex-col items-start">
					<span class="font-bold"
						>{member.character.name || `Character ${member.id.split('_').pop()}`}</span
					>
				</div>
			</button>
		{/each}
	</div>
{/if}
