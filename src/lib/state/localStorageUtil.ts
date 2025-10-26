/**
 * Centralized Local Storage Utilities
 * Provides typed helpers for safely reading and writing JSON state.
 */

export function getFromLocalStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	try {
		const stored = localStorage.getItem(key);
		if (stored === null) return defaultValue;
		return JSON.parse(stored) as T;
	} catch {
		return defaultValue;
	}
}

export function saveToLocalStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Swallow errors (quota, serialization) to avoid UI crashes
	}
}
