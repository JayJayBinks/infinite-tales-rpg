<script lang="ts">
	import type { Party } from '$lib/ai/agents/characterAgent';
	import { switchActiveCharacter } from '../../routes/game/partyLogic';
	import { partyState, gameState } from '$lib/state/stores';
	import RestrainedExplanationModal from '$lib/components/interaction_modals/RestrainedExplanationModal.svelte';

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

	function isRestrained(memberId: string): boolean {
		console.log('Checking if member is restrained:', memberId);
		return !!partyState.restrainedExplanationByMember[memberId];
	}

	// State for restrained modal
	let restrainedModalMemberId: string | null = $state(null);
	let restrainedModalName: string = $state('');
	let restrainedModalExplanation: string = $state('');

	function showRestrainedModal(memberId: string, memberName: string, event: MouseEvent) {
		// Prevent switching character when tapping the lock
		event.stopPropagation();
		restrainedModalMemberId = memberId;
		restrainedModalName = memberName;
		restrainedModalExplanation = partyState.restrainedExplanationByMember[memberId] || '';
	}

	function closeRestrainedModal() {
		restrainedModalMemberId = null;
		restrainedModalName = '';
		restrainedModalExplanation = '';
	}
</script>

{#if party && party.members.length > 1}
	<div class="party-switcher mb-4 flex flex-wrap justify-center gap-2">
		{#each party.members as member}
			{@const isActive = party.activeCharacterId === member.id}
			<button
				class="btn btn-sm relative w-1/3"
				class:btn-primary={isActive}
				class:btn-outline={!isActive}
				onclick={() => handleSwitch(member.id)}
				title={(member.character?.class || 'No class') + (isRestrained(member.id) ? ' - Restrained' : '')}
			>
				<div class="flex w-full flex-col items-start">
					<span class="font-bold pr-4"
						>{member.character?.name || `Character ${member.id.split('_').pop()}`}</span
					>
				</div>
				{#if isRestrained(member.id)}
					<span
						role="button"
						tabindex="0"
						class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error/90 p-0.5 text-error-content shadow ring-1 ring-error-content/30 transition hover:scale-110 focus:scale-110 focus:outline-none"
						aria-label="Character restrained - tap for details"
						data-testid="restrained-indicator"
						onclick={(e) => showRestrainedModal(member.id, member.character.name, e)}
						onkeydown={(e) => { if(e.key==='Enter' || e.key===' ') { showRestrainedModal(member.id, member.character.name, e as any); } }}
					>
						<svg
							x="0px"
							y="0px"
							viewBox="0 0 24 24"
							class="h-3.5 w-3.5 fill-current"
							role="img"
							aria-hidden="false"
						>
							<title>Restrained</title>
							<path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9zm3 4a1.75 1.75 0 011.75 1.75c0 .74-.463 1.374-1.108 1.625L13 19h-2l.358-1.625A1.751 1.751 0 0112 14z" />
						</svg>
					</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

{#if restrainedModalMemberId}
	<RestrainedExplanationModal
		characterName={restrainedModalName}
		explanation={restrainedModalExplanation}
		onclose={closeRestrainedModal}
	/>
{/if}
