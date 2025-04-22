// src/lib/backgroundFetch.js (or .ts)
import { writable } from 'svelte/store'; // Or use Svelte 5 runes outside components if preferred, though stores are standard for shared state
import { useLocalStorage } from './useLocalStorage.svelte';
import type { Action } from 'svelte/action';

// Store to hold results/status accessible by components
export const backgroundFetchStatus = writable({
    isLoading: false,
    error: null,
    data: null,
    isComplete: false
});

let activeFetch: { promise: Promise<any>; controller: AbortController } | null = null; // Keep track of the ongoing fetch

export async function startBackgroundFetch(promise: Promise<any>, localStorageKeyToUpdate: any, callback: (data: any) => void){
    // Prevent starting a new fetch if one is already active
    if (activeFetch) {
        console.warn("Background fetch already in progress.");
        return; // Or cancel the existing one if that's desired
    }

    backgroundFetchStatus.set({
        isLoading: true,
        error: null,
        data: null,
        isComplete: false
    });

    // Use AbortController to potentially cancel the fetch later if needed
    const controller = new AbortController();
    const signal = controller.signal;

    try {
        // Store the promise and controller
        activeFetch = {
            promise,
            controller: controller
        };

        const response = await activeFetch.promise;
        // Handle different response types (e.g., json, text)
        const data = response // Or response.text(), response.blob(), etc.
        console.log("Fetch done.");
        localStorage.setItem(localStorageKeyToUpdate, JSON.stringify(data));
        callback(data);
        backgroundFetchStatus.set({
            isLoading: false,
            error: null,
            data: data,
            isComplete: true
        });

    } catch (e: unknown) {
        // Check if the error was due to abortion
        if (e instanceof Error && e.name === 'AbortError') {
             console.log('Fetch was aborted.');
             // Optionally reset state or handle differently for abortion
             backgroundFetchStatus.set({
                isLoading: false,
                error: 'Fetch aborted', // Or keep previous data if partially complete
                data: backgroundFetchStatus.data, // Keep potential partial data
                isComplete: true, // Consider aborted as 'complete' in this context
             });
        } else {
             console.error("Background fetch failed:", e);
             backgroundFetchStatus.set({
                 isLoading: false,
                 error: e,
                 data: null,
                 isComplete: true,
                 progress: 0
             });
        }
    } finally {
        // Clear the active fetch regardless of outcome
        activeFetch = null;
    }
}

// Optional: function to cancel the ongoing fetch
export function cancelBackgroundFetch() {
    if (activeFetch && !backgroundFetchStatus.isLoading) {
         console.warn("No active background fetch to cancel.");
         return;
    }
    if (activeFetch && activeFetch.controller) {
        activeFetch.controller.abort();
        // The catch block in startBackgroundFetch will handle the state update
    }
}