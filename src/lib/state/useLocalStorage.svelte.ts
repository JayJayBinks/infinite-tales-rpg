import {onMount} from 'svelte';
import cloneDeep from "lodash.clonedeep";

const useLocalStorage = (key, initialValue = undefined) => {

    function getInitial() {
        return cloneDeep(initialValue);
    }

    let value = $state(getInitial());
    let isMounted = false;

    $effect(() => {
        value; //needed for triggering effect
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