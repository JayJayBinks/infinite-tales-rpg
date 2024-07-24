import {onMount} from 'svelte';

const useLocalStorage = (key, initialValue = undefined) => {

    function getInitial() {
        return typeof initialValue === 'object' && !Array.isArray(initialValue) ? {...initialValue} : initialValue;
    }
    let value = $state(getInitial());
    let isMounted = false;

    $effect(() => {
        value; //needed for triggering effect
        if (isMounted) {
            localStorage.setItem(key, JSON.stringify(value));
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
        set value(v) {
            value = v;
        },
        reset() {
            value = getInitial();
        },
        resetProperty(stateRef) {
            value[stateRef] = initialValue ? getInitial()[stateRef] : undefined;
        }
    };
};

export default useLocalStorage;