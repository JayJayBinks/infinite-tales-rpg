import { onMount } from 'svelte';
import cloneDeep from 'lodash.clonedeep';

export function useLocalStorage<T>(key: string, initialValue?: T) {
	function getInitial(): T | undefined {
		return cloneDeep(initialValue);
	}

	let value = $state<T>(getInitial() as T) as T;
	let isMounted = false;

	$effect(() => {
		// Need to read all values to trigger effect
		const json = JSON.stringify(value);
		if (isMounted) {
			if (value !== undefined) {
				localStorage.setItem(key, json);
			} else {
				localStorage.removeItem(key);
			}
		}
	});

	onMount(() => {
		const currentValue = localStorage.getItem(key);
		if (currentValue && currentValue !== 'undefined') {
			try {
				value = JSON.parse(currentValue);
			} catch (e) {
				console.warn(`Failed to parse localStorage key "${key}":`, e);
				// Keep initial value if parse fails
			}
		}
		isMounted = true;
	});

	return {
		get value() {
			return value;
		},
		set value(v: T) {
			value = v as T;
		},
		reset() {
			value = getInitial() as T;
		},
		resetProperty(stateRef: keyof T) {
			if (value && initialValue) {
				// @ts-expect-error can never be undefined
				value[stateRef] = getInitial()?.[stateRef];
			}
		}
	};
}
