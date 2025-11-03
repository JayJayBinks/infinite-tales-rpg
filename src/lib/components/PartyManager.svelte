<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { updatePartyMemberImmutable, type PartyMemberProfile } from '$lib/types/party';

	let {
		allowGeneration = false,
		onGenerateParty,
		onGenerateMember,
		isBusy = false
	}: {
		allowGeneration?: boolean;
		onGenerateParty?: () => void | Promise<void>;
		onGenerateMember?: (member: PartyMemberProfile) => void | Promise<void>;
		isBusy?: boolean;
	} = $props();

	const partyMembersState = useLocalStorage<PartyMemberProfile[]>('partyMembersState', []);
	const activePartyMemberIdState = useLocalStorage<string | null>('activePartyMemberIdState', null);

	const activeMember = $derived(
		partyMembersState.value.find((member) => member.id === activePartyMemberIdState.value) ?? null
	);

	$effect(() => {
		if (!activePartyMemberIdState.value && partyMembersState.value.length > 0) {
			activePartyMemberIdState.value = partyMembersState.value[0].id;
		}
	});

	function selectMember(member: PartyMemberProfile) {
		if (!member) return;
		activePartyMemberIdState.value = member.id;
	}

	function handleRename(member: PartyMemberProfile, value: string) {
		partyMembersState.value = updatePartyMemberImmutable(partyMembersState.value, member.id, {
			displayName: value
		});
	}

	async function handleGenerateParty() {
		await onGenerateParty?.();
	}

	async function handleGenerateMember() {
		if (!activeMember) return;
		await onGenerateMember?.(activeMember);
	}
</script>

<div class="mt-4 flex flex-col gap-4">
	{#if !partyMembersState.value.length}
		<p class="text-center text-sm opacity-80">
			Add characters on the previous step to configure their stats here.
		</p>
	{:else}
		<div class="flex flex-col items-center gap-3">
			<div class="tabs tabs-boxed flex flex-wrap justify-center">
				{#each partyMembersState.value as member, index}
					<button
						type="button"
						class="tab"
						class:tab-active={member.id === activePartyMemberIdState.value}
						onclick={() => selectMember(member)}
					>
						{member.displayName || member.description?.name || `Character ${index + 1}`}
					</button>
				{/each}
			</div>
			{#if activeMember}
				<label class="input input-bordered input-sm flex w-full max-w-xs items-center gap-2">
					<span class="text-xs uppercase opacity-70">Label</span>
					<input
						type="text"
						class="grow"
						placeholder="Display name"
						value={activeMember.displayName}
						oninput={(event) => handleRename(activeMember, event.currentTarget.value)}
					/>
				</label>
			{/if}
			{#if allowGeneration}
				<div class="flex flex-wrap items-center justify-center gap-3">
					<button
						type="button"
						class="btn btn-accent"
						disabled={isBusy || !partyMembersState.value.length}
						onclick={handleGenerateParty}
					>
						Randomize Entire Party
					</button>
					<button
						type="button"
						class="btn btn-neutral"
						disabled={isBusy || !activeMember}
						onclick={handleGenerateMember}
					>
						Randomize Active Member
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
