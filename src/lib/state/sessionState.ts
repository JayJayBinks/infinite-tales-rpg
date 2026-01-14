import { writable } from 'svelte/store';

// In-memory flag that is NOT persisted across page reloads.
// When set to true, the modal will not be shown again during the same session (client-side navigation).
export const seenBillingModalSession = writable(false);
