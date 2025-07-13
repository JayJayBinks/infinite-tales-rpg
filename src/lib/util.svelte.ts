import { errorState } from './state/errorState.svelte';
import isPlainObject from 'lodash.isplainobject';
import isString from 'lodash.isstring';
// pdfjs-dist and TextItem are no longer needed as loadPDF was removed
import type { Action } from '$lib/ai/agents/gameAgent';
import type { NpcID } from '$lib/ai/agents/characterStatsAgent';

export type ThoughtsState = {
	storyThoughts: string;
	actionsThoughts: string;
	eventThoughts: string;
};

export const initialThoughtsState: ThoughtsState = {
	storyThoughts: '',
	actionsThoughts: '',
	eventThoughts: ''
};

export function stringifyPretty(object: unknown) {
	return JSON.stringify(object, null, 2);
}

export function handleError(e: string, retryable = true) {
	console.log(e);
	if (!errorState.exception) {
		errorState.exception = e;
		errorState.userMessage = e;
		errorState.retryable = retryable;
	}
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

// let worker; // No longer needed as loadPDF which used it was removed

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

export const removeEmptyValues = (object: object) =>
	object &&
	Object.fromEntries(
		Object.entries(object)
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			.filter(([_, value]) => value && Object.keys(value).length > 0)
	);

export function playAudioFromStream(text, voice, onended?): HTMLAudioElement {
	const audio = new Audio();
	audio.src = getTTSUrl(text, voice);
	audio.autoplay = true;
	if (onended) {
		audio.onended = onended;
	}
	return audio;
}

export function getTTSUrl(text, voice) {
	return '/api/edgeTTSStream?voice=' + encodeURI(voice) + '&text=' + encodeURI(text);
}

export function getTextForActionButton(action: Action) {
	let text = '';
	const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;

	if (cost > 0) {
		const costString = ` (${cost} ${action.resource_cost?.resource_key?.replaceAll('_', ' ')}).`;
		text = action.text.replaceAll('.', '');
		text += costString;
	} else {
		const hasEndingChar =
			action.text.endsWith('.') ||
			action.text.endsWith('. ') ||
			action.text.endsWith('! ') ||
			action.text.endsWith('!') ||
			action.text.endsWith('? ') ||
			action.text.endsWith('?');
		text += hasEndingChar ? action.text : action.text + '.';
	}
	return text;
}

export const getNPCDisplayName = (npc: NpcID) => {
	return npc.displayName || npc.uniqueTechnicalNameId || JSON.stringify(npc);
};

export const getNPCTechnicalID = (npc: NpcID) => {
	return npc.uniqueTechnicalNameId || npc.displayName || JSON.stringify(npc);
};

export function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}