<script lang="ts">
	import type { Party } from '$lib/ai/agents/characterAgent';
	import { switchActiveCharacter } from '../../routes/game/partyLogic';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	// Per-member restrained state (string explanation or null)
	const restrainedExplanationByMemberState = useLocalStorage<Record<string, string | null>>(
		'restrainedExplanationByMemberState',
		{}
	);

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
		const v = restrainedExplanationByMemberState.value[memberId];
		return !!v; // non-null, non-empty string indicates restrained
	}

	// Which member's restraint info popover is open (if any)
	let lockInfoOpenFor: string | null = $state(null);

	function toggleLockInfo(memberId: string, event: MouseEvent) {
		// Prevent switching character when tapping the lock
		event.stopPropagation();
		lockInfoOpenFor = lockInfoOpenFor === memberId ? null : memberId;
	}

	function closeLockInfoIfOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest?.('.restrained-lock-popover')) {
			lockInfoOpenFor = null;
		}
	}

	// Close on outside click (basic – page level listener added when any popover open)
	$effect(() => {
		if (lockInfoOpenFor) {
			window.addEventListener('click', closeLockInfoIfOutside, { once: true });
		}
	});
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
				title={(member.character.class || 'No class') +
					(isRestrained(member.id) ? ' - Restrained' : '')}
			>
				<div class="flex w-full flex-col items-start">
					<span class="pr-4 font-bold"
						>{member.character.name || `Character ${member.id.split('_').pop()}`}</span
					>
				</div>
				{#if isRestrained(member.id)}
					<button
						type="button"
						class="restrained-lock-popover group absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error/90 p-0.5 text-error-content shadow ring-1 ring-error-content/30 transition hover:scale-110 focus:scale-110 focus:outline-none"
						aria-label="Character restrained - tap for details"
						onclick={(e) => toggleLockInfo(member.id, e)}
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
							<path
								d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9zm3 4a1.75 1.75 0 011.75 1.75c0 .74-.463 1.374-1.108 1.625L13 19h-2l.358-1.625A1.751 1.751 0 0112 14z"
							/>
						</svg>
						{#if lockInfoOpenFor === member.id}
							<div
								class="absolute right-0 top-6 z-30 w-56 max-w-xs rounded-md border border-error/40 bg-base-200 p-2 text-left text-[0.7rem] leading-snug shadow-lg backdrop-blur-sm"
							>
								<div class="mb-1 font-semibold text-error">Restrained</div>
								<p class="whitespace-pre-wrap">
									{restrainedExplanationByMemberState.value[member.id]}
								</p>
								<button
									type="button"
									class="btn btn-ghost btn-xs mt-2 w-full"
									onclick={(e) => {
										e.stopPropagation();
										lockInfoOpenFor = null;
									}}>Close</button
								>
							</div>
						{/if}
					</button>
				{/if}
			</button>
		{/each}
	</div>
{/if}
