import {errorState} from "./state/errorState.svelte";

export function stringifyPretty(object) {
    return JSON.stringify(object, null, 2);
}

export function handleError(e) {
    console.log(e);
    errorState.exception = e;
    errorState.userMessage = e;
}

export function navigate(path) {
    const a = document.createElement('a');
    a.href = '/game' + path;
    a.click();
}

export const downloadLocalStorageAsJson = () => {
    const toSave = {...localStorage};
    delete toSave.apiKeyState;
    const json = encodeURIComponent(
        JSON.stringify(
            (function () {
                const o = {};
                for (const k of Object.keys(toSave)) {
                    o[k] = JSON.parse(toSave[k])
                }
                return o
            }())
            , null, 2)
    );
    const dataStr = "data:application/json;charset=utf-8," + json;
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "infinite-tales-rpg.json");
    dlAnchorElem.click();
}

export const importJsonFromFile = (callback) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.click();
    fileInput.onchange
    fileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader()
            reader.onload = (evt) => {
                const parsed = JSON.parse(new TextDecoder("utf-8").decode(evt.target.result));
                callback(parsed);
            }
            reader.readAsArrayBuffer(file);
        }
    });
}