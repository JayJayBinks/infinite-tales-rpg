<!-- src/lib/components/CustomBehaviorModal.svelte -->
<script lang="ts">
	import { initialSystemInstructionsState, type SystemInstructionsState } from '$lib/ai/llm';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	// --- Props ---
	let { onclose }: { onclose: () => void } = $props();

	const systemInstructionsState = useLocalStorage<SystemInstructionsState>(
		'systemInstructionsState',
		initialSystemInstructionsState
	);
</script>

<dialog open class="modal z-50" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex w-11/12 max-w-2xl flex-col items-center text-center">
		<h3 class="text-lg font-bold">Custom AI Behavior Settings</h3>

		<p class="mt-2 text-sm text-base-content/80">
			You may need to start a new Tale after changing instructions.
		</p>

		<!-- Story Agent Instruction -->
		<label class="form-control mt-5 w-full">
			Story Agent Instruction (GM, NPCs, World)
			<textarea
				bind:value={systemInstructionsState.value.storyAgentInstruction}
				placeholder="Focus on narrative style. E.g., 'Describe environments vividly. Make NPCs quirky.'"
				class="textarea textarea-bordered mt-2 h-24"
			></textarea>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				Guides tone, pacing, descriptions, and NPC interactions.
			</small>
		</label>

		<!-- Action Agent Instruction -->
		<label class="form-control mt-5 w-full">
			Action Agent Instruction (Non-Combat Actions)
			<textarea
				bind:value={systemInstructionsState.value.actionAgentInstruction}
				placeholder="Focus on action resolution. E.g., 'Make skill checks easy. Always provide one funny, nonsensical action.'"
				class="textarea textarea-bordered mt-2 h-24"
			></textarea>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				Applied to generating actions (general, items, skills)
			</small>
		</label>

		<!-- Combat Agent Instruction -->
		<label class="form-control mt-5 w-full">
			Combat Agent Instruction
			<textarea
				bind:value={systemInstructionsState.value.combatAgentInstruction}
				placeholder="Focus on combat style. E.g., 'Player Character only takes half damage. Enemies fight tactically.'"
				class="textarea textarea-bordered mt-2 h-24"
			></textarea>
			<small class="m-auto mt-2 text-xs text-base-content/70"> Applied only when in combat </small>
		</label>

		<!-- General System Instruction -->
		<label class="form-control mt-5 w-full">
			General System Instruction
			<textarea
				bind:value={systemInstructionsState.value.generalSystemInstruction}
				placeholder="Overall guidance. E.g., 'Maintain a serious tone. The world is dangerous.'"
				class="textarea textarea-bordered mt-2 h-24"
			></textarea>
			<small class="red m-auto mt-2 text-xs text-base-content/70">
				Attention! This prompt is added to ALL AI generations
			</small>
		</label>

		<!-- Close Button -->
		<div class="modal-action mt-6">
			<button class="btn btn-info" onclick={onclose}>Close</button>
		</div>
	</div>
	<!-- Optional: Click outside to close -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={onclose}>Close</button>
	</form>
</dialog>
