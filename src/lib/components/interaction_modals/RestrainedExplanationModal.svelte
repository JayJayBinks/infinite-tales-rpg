<script lang="ts">
	let {
		characterName,
		explanation,
		onclose
	}: {
		characterName: string;
		explanation: string;
		onclose: () => void;
	} = $props();

	let dialogRef: HTMLDialogElement;

	$effect(() => {
		if (dialogRef && explanation) {
			dialogRef.showModal();
		}
	});

	function close() {
		dialogRef?.close();
		onclose();
	}
</script>

<dialog bind:this={dialogRef} class="modal" onclose={close}>
	<div class="modal-box max-w-sm">
		<h3 class="font-bold text-lg text-error flex items-center gap-2">
			<svg
				x="0px"
				y="0px"
				viewBox="0 0 24 24"
				class="h-5 w-5 fill-current"
				role="img"
				aria-hidden="false"
			>
				<path
					d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9zm3 4a1.75 1.75 0 011.75 1.75c0 .74-.463 1.374-1.108 1.625L13 19h-2l.358-1.625A1.751 1.751 0 0112 14z"
				/>
			</svg>
			{characterName} is Restrained
		</h3>
		<p class="py-4 whitespace-pre-wrap text-sm">{explanation}</p>
		<div class="modal-action">
			<button class="btn btn-sm" onclick={close}>Close</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
