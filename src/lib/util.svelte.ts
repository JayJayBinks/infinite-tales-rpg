import {errorState} from "./state/errorState.svelte";

export function stringifyPretty(object) {
    return JSON.stringify(object, null, 2);
}

export function handleError(e) {
    console.log(e);
    errorState.exception = e;
    errorState.userMessage = e;
}

export function navigate(path){
    const a = document.createElement('a');
    a.href = path;
    a.click();
}
