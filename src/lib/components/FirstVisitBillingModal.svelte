<script lang="ts">
  import { onMount } from 'svelte';
  import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

  // Persistent global flag stored in localStorage: once acknowledged, modal won't show again.
  const seenBillingModalGlobal = useLocalStorage<boolean>('seenBillingModalGlobal', false);

  let showModal = false;
  const actionsPerHour = 60;

  // Estimates (from the previous calculations)
  const typicalActionCost = 0.013298; // USD per action (early/light)
  const lateActionCost = 0.014258; // USD per action (late/memory-intensive)

  const typicalPerHour = (typicalActionCost * actionsPerHour).toFixed(2);
  const latePerHour = (lateActionCost * actionsPerHour).toFixed(2);

  onMount(() => {
    // Show modal only on a fresh load (not on client-side route changes).
    if (typeof window === 'undefined') return;
    if (seenBillingModalGlobal.value) {
      showModal = false;
      return;
    }
    const shownThisLoad = sessionStorage.getItem('billingModalShownThisLoad');
    if (!shownThisLoad) {
      showModal = true;
      sessionStorage.setItem('billingModalShownThisLoad', '1');
    } else {
      showModal = false;
    }
  });

  function acknowledge() {
    // Persist globally so the modal won't show on future page reloads.
    seenBillingModalGlobal.value = true;
    showModal = false;
  }
</script>

{#if showModal}
  <dialog open class="modal z-50">
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg">Important: Billing Required ⚠️</h3>
      <p class="mt-2 text-sm">
        The free Gemini tier has been significantly reduced. Billing must be enabled with a Google Gemini API key for AI features to function. Billing is charged directly by Google for the Gemini API — this game does not bill you directly.
      </p>


      <div class="mt-4">
        <p class="font-semibold">What you need to do:</p>
        <ol class="list-decimal list-inside mt-2">
          <li>Enable billing & create an API key: <a class="link link-primary" href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noreferrer">https://aistudio.google.com/app/api-keys</a></li>
          <li>Enter the key in the app settings (Settings → AI)</li>
        </ol>
      </div> 

      <div class="mt-4">
        <div class="flex items-center justify-between">
          <p class="font-semibold">Cost estimate</p>
          <small class="text-xs text-muted">Prices as of January / 2026</small>
        </div>
        <p class="text-sm mt-2">
          At approx. <strong>1 player action per minute</strong> (~60 actions/hour) you can expect roughly:
        </p>
        <ul class="list-disc list-inside mt-2 text-sm">
          <li>Typical scenario: ~ <strong>${latePerHour}$ / hour</strong> (≈ ${lateActionCost.toFixed(4)}$ / action)</li>
        </ul>
        <p class="text-sm mt-2 text-muted">
          Note: Special cases (heavy combat, many images, or complex custom actions) can increase costs significantly (peak usage 2×).
        </p>
      </div> 

      <div class="modal-action mt-4">
        <a class="btn btn-primary" href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noreferrer">Enable billing</a>
        <button class="btn" onclick={acknowledge}>Got it</button>
      </div> 
    </div>
  </dialog>
{/if}

<style>
  /* small visual tweak for the modal box */
  .modal-box { padding: 1.25rem; }
</style>
