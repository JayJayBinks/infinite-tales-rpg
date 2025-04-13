import JSONParser from '@streamparser/json/jsonparser.js';
import type { LLM, LLMRequest } from './llm';
import type { GenerateContentStreamResult } from '@google/generative-ai';

/**
 * Fetches a JSON stream, parses it, calls a callback for progressive
 * updates of the "story" field, and returns the full parsed JSON object.
 *
 * @param {LLMRequest} request The LLM request object.
 * @param {LLM} llm The LLM instance to use for the request.
 * @param {function(storyChunk: string, isComplete: boolean): void} storyUpdateCallback
 *   A function to be called with updates to the "story" field.
 *   - storyChunk: The story text parsed so far (or the complete text).
 *   - isComplete: True if this is the final update for the story, false otherwise.
 * @returns {Promise<object|null>} A promise that resolves with the fully parsed JSON object,
 *   or null if parsing fails or the stream is empty/invalid. Rejects on fetch errors.
 */
export async function requestLLMJsonStream(
	request: LLMRequest,
	llm: LLM,
	storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void
): Promise<object | undefined> {
	let finalJsonObject: any = null;
	let jsonStarted = false;
	let accumulatedRawText = '';
	let accumulatedJsonText = '';
	// Buffer to hold potential start-of-marker chars from the *end* of the previous chunk
	let pendingMarkerCheck = '';
	const MAX_MARKER_PREFIX_LEN = 8; // Length of "```json\n"

	if (typeof storyUpdateCallback !== 'function') {
		console.error('Error: storyUpdateCallback must be a function.');
		throw new Error('storyUpdateCallback must be a function.');
	}

	const liveParser = new JSONParser({ emitPartialValues: true, emitPartialTokens: true });

	const liveParserPromise = new Promise<void>((resolve) => {
		liveParser.onValue = ({ value, key, partial }) => {
			/* ... same as before ... */
			try {
				if (key === 'story' && typeof value === 'string') {
					storyUpdateCallback(value, !partial);
				}
			} catch (callbackError) {
				console.error('Error inside storyUpdateCallback:', callbackError);
			}
		};
		liveParser.onError = (err) => {
			/* ... same as before ... */
			console.warn('Live JSON Parser Error:', err.message);
			resolve();
		};
		liveParser.onEnd = () => {
			/* ... same as before ... */
			console.log('--> Live parser finished processing input.');
			resolve();
		};
	});

	const geminiStreamResult = (await llm.generateContent(request)) as GenerateContentStreamResult;
	if (
		!geminiStreamResult ||
		typeof geminiStreamResult.stream !== 'object' ||
		typeof geminiStreamResult.stream[Symbol.asyncIterator] !== 'function'
	) {
		console.error('Failed to get a valid stream from generateContent.');
		throw new Error('Invalid stream response from LLM.');
	}

	try {
		console.log('--- Starting processing Gemini stream ---');
		for await (const chunk of geminiStreamResult.stream) {
			const chunkText = chunk?.text();
			if (typeof chunkText !== 'string') continue; // Skip invalid chunks

			accumulatedRawText += chunkText;
			if (chunkText.length === 0) continue; // Skip empty chunks

			const textToProcess = chunkText; // The current chunk's text
			let markerFoundInThisPass = false;

			if (!jsonStarted) {
				// Combine pending prefix with current chunk for searching
				const effectiveSearchText = pendingMarkerCheck + textToProcess;

				const markerWithNewline = '```json\n';
				const markerWithoutNewline = '```json';

				let markerIndex = -1;
				let markerLength = 0;

				// Prioritize finding the marker with newline
				markerIndex = effectiveSearchText.indexOf(markerWithNewline);
				if (markerIndex !== -1) {
					markerLength = markerWithNewline.length;
					console.log("--> Found '```json\\n' marker sequence.");
				} else {
					// If not found, check for the marker without newline
					markerIndex = effectiveSearchText.indexOf(markerWithoutNewline);
					if (markerIndex !== -1) {
						markerLength = markerWithoutNewline.length;
						console.log("--> Found '```json' marker sequence.");
					}
				}

				if (markerIndex !== -1) {
					// Marker FOUND (potentially spanning chunks)
					markerFoundInThisPass = true;
					jsonStarted = true;

					// Calculate where the JSON content starts in the *original* textToProcess
					const jsonContentStartIndexInEffective = markerIndex + markerLength;
					const jsonContentStartIndexInOriginal = Math.max(
						0,
						jsonContentStartIndexInEffective - pendingMarkerCheck.length
					);

					// The part of the current chunk that is actual JSON content
					const jsonPartInCurrentChunk = textToProcess.substring(jsonContentStartIndexInOriginal);

					if (jsonPartInCurrentChunk.length > 0) {
						accumulatedJsonText += jsonPartInCurrentChunk;
						try {
							liveParser.write(jsonPartInCurrentChunk);
						} catch (liveParserWriteError) {
							console.warn(
								'Live JSON Parser Write Error:',
								(liveParserWriteError as Error).message
							);
						}
					}
					// Clear the pending buffer as the marker is now fully processed
					pendingMarkerCheck = '';
				} else {
					// Marker NOT found yet. Update pendingMarkerCheck for the next iteration.
					// Store the tail end of the effective search text that could be a prefix.
					pendingMarkerCheck = effectiveSearchText.substring(
						Math.max(0, effectiveSearchText.length - MAX_MARKER_PREFIX_LEN)
					);
					// We need to ensure pendingMarkerCheck *only* contains valid prefixes
					// Iterate backwards ensuring it matches a prefix of ```json\n
					let validPrefix = '';
					for (let i = Math.min(pendingMarkerCheck.length, MAX_MARKER_PREFIX_LEN); i > 0; i--) {
						const prefix = pendingMarkerCheck.substring(pendingMarkerCheck.length - i);
						if (markerWithNewline.startsWith(prefix)) {
							validPrefix = prefix;
							break;
						}
					}
					pendingMarkerCheck = validPrefix; // Store the longest valid prefix found at the end
					// console.log("Marker not found, pending prefix:", pendingMarkerCheck); // Debugging
					// Since the marker wasn't found, none of *this* chunk is JSON content yet
					continue; // Skip to the next chunk
				}
			}

			// --- Process chunk *after* marker is found (or if it was found in this pass) ---
			// This block runs if jsonStarted is true, but *only* processes
			// the part of the chunk *not* consumed by the marker detection above.
			if (jsonStarted && !markerFoundInThisPass && textToProcess.length > 0) {
				// If marker was found in a *previous* pass, process the *entire* current chunk
				accumulatedJsonText += textToProcess;
				try {
					liveParser.write(textToProcess);
				} catch (liveParserWriteError) {
					console.warn('Live JSON Parser Write Error:', (liveParserWriteError as Error).message);
				}
			}
		} // End of stream loop

		console.log('--- Gemini stream ended ---');
		liveParser.end();
		await liveParserPromise;

		// --- Final Cleaning and Parsing ---
		console.log('--- Performing final cleaning and parsing ---');
		let cleanedJsonText = accumulatedJsonText; // Start with everything accumulated *after* the marker

		// 1. Remove trailing ``` marker (robustly)
		const endMarker = '```';
		if (cleanedJsonText.endsWith(endMarker)) {
			cleanedJsonText = cleanedJsonText
				.substring(0, cleanedJsonText.length - endMarker.length)
				.trimEnd();
			console.log("--> Removed trailing '```' marker.");
		} else {
			// Check if it ends with ``` plus whitespace (less common but possible)
			const trimmedEnd = cleanedJsonText.trimEnd();
			if (trimmedEnd.endsWith(endMarker)) {
				cleanedJsonText = trimmedEnd.substring(0, trimmedEnd.length - endMarker.length).trimEnd();
				console.log("--> Removed trailing '```' marker (with whitespace).");
			} else {
				// Check if the raw text ended with it, even if not in accumulated
				if (accumulatedRawText.trimEnd().endsWith(endMarker)) {
					console.warn(
						"Trailing '```' marker found in raw text but not cleanly at the end of accumulated JSON. Final JSON might be truncated or include extra content."
					);
				} else {
					console.warn("Trailing '```' marker not found at the end of accumulated JSON content.");
				}
			}
		}

		// 2. Final trim
		cleanedJsonText = cleanedJsonText.trim();

		// 3. Basic validation & Final Parse
		if (
			cleanedJsonText.length > 0 &&
			(!cleanedJsonText.startsWith('{') || !cleanedJsonText.endsWith('}'))
		) {
			console.warn("Cleaned text doesn't seem to start/end with braces. Final parse might fail.");
		} else if (cleanedJsonText.length === 0 && accumulatedRawText.includes('{')) {
			console.warn(
				"Cleaned JSON text is empty, but raw text contained '{'. Check marker stripping logic."
			);
		}

		try {
			if (cleanedJsonText.length === 0) {
				console.warn(
					'--> Cleaned JSON text is empty after stripping markers. Returning undefined.'
				);
				storyUpdateCallback('', true);
				return undefined;
			}
			finalJsonObject = JSON.parse(cleanedJsonText);
			console.log('--> Final JSON object successfully parsed after cleaning.');
			const finalStory = typeof finalJsonObject?.story === 'string' ? finalJsonObject.story : '';
			storyUpdateCallback(finalStory, true); // Ensure final state update
			return finalJsonObject;
		} catch (parseError) {
			// ... (same final parse error handling as before) ...
			console.error('--- FINAL JSON PARSE FAILED ---');
			console.error('Error:', (parseError as Error).message);
			console.error(
				'Cleaned JSON Text (first/last 100 chars):',
				cleanedJsonText.substring(0, 100) +
					'...' +
					cleanedJsonText.substring(cleanedJsonText.length - 100)
			);
			console.error(
				'Full Raw Text (first 500 chars):',
				accumulatedRawText.substring(0, 500) + (accumulatedRawText.length > 500 ? '...' : '')
			);
			try {
				storyUpdateCallback(`<p>Error: Failed to parse the final JSON response.</p>`, true);
			} catch (cbError) {
				console.error(
					'Error calling storyUpdateCallback during final parse error handling:',
					cbError
				);
			}
			throw new Error(`Failed to parse final JSON: ${(parseError as Error).message}`);
		}
	} catch (streamError) {
		// ... (same stream error handling as before) ...
		console.error('Error iterating Gemini stream:', streamError);
		try {
			storyUpdateCallback(
				`<p>Error reading response stream: ${(streamError as Error).message}</p>`,
				true
			);
		} catch (cbError) {
			console.error('Error calling storyUpdateCallback during stream error handling:', cbError);
		}
		throw streamError;
	}
}
