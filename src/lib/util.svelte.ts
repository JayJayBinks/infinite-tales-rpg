import { errorState } from './state/errorState.svelte';
import isPlainObject from 'lodash.isplainobject';
import isString from 'lodash.isstring';

export function stringifyPretty(object: unknown) {
	return JSON.stringify(object, null, 2);
}

export function handleError(e: string) {
	console.log(e);
	errorState.exception = e;
	errorState.userMessage = e;
}

export function navigate(path: string) {
	const a = document.createElement('a');
	a.href = '/game' + path;
	a.click();
}

export const downloadLocalStorageAsJson = () => {
	const toSave = { ...localStorage };
	delete toSave.apiKeyState;
	const json = encodeURIComponent(
		JSON.stringify(
			(function () {
				const o = {};
				for (const k of Object.keys(toSave)) {
					o[k] = JSON.parse(toSave[k]);
				}
				return o;
			})(),
			null,
			2
		)
	);
	const dataStr = 'data:application/json;charset=utf-8,' + json;
	const dlAnchorElem = document.createElement('a');
	dlAnchorElem.setAttribute('href', dataStr);
	dlAnchorElem.setAttribute('download', 'infinite-tales-rpg.json');
	dlAnchorElem.click();
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const importJsonFromFile = (callback: Function) => {
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = 'application/json';
	fileInput.click();
	fileInput.addEventListener('change', function (event) {
		// @ts-expect-error can never be null
		const file = (<HTMLInputElement>event.target).files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (evt) => {
				// @ts-expect-error can never be null
				const parsed = JSON.parse(new TextDecoder('utf-8').decode(evt.target.result));
				callback(parsed);
			};
			reader.readAsArrayBuffer(file);
		}
	});
};

export function getRowsForTextarea(object: object) {
	const mappedRows = {};
	if (!object) {
		return undefined;
	}
	Object.keys(object).forEach((key) => {
		if (isPlainObject(object[key])) {
			mappedRows[key] = getRowsForTextarea(object[key]);
		} else {
			const textLength = (object[key] + '').length;
			mappedRows[key] = 2;
			if (textLength >= 100) {
				mappedRows[key] = 3;
			}
			if (textLength >= 200) {
				mappedRows[key] = 4;
			}
			if (textLength >= 300) {
				mappedRows[key] = 5;
			}
			if (textLength <= 30) {
				mappedRows[key] = 1;
			}
		}
	});
	return mappedRows;
}

export function parseState(newState: object) {
	Object.keys(newState).forEach((key) => {
		if (isString(newState[key])) {
			newState[key] = JSON.parse(newState[key]);
		}
	});
}

export function getRandomInteger(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
