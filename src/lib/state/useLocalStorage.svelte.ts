import { onMount } from 'svelte';
import cloneDeep from 'lodash.clonedeep';

export function useLocalStorage<T>(key: string, initialValue?: T) {
	function getInitial(): T | undefined {
		return cloneDeep(initialValue);
	}

	let value = $state<T>(getInitial() as T) as T;
	let isMounted = false;

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		value; // needed for triggering effect
		if (isMounted) {
			if (value !== undefined) {
				localStorage.setItem(key, JSON.stringify(value));
			} else {
				localStorage.removeItem(key);
			}
		}
	});

	onMount(() => {
		const currentValue = localStorage.getItem(key);
		if (currentValue) value = JSON.parse(currentValue);
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