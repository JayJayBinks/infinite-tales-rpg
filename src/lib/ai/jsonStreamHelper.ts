import JSONParser from '@streamparser/json/jsonparser.js';
import type { LLM, LLMRequest } from './llm';
import type { GenerateContentResponse } from '@google/genai';
import { getThoughtsFromResponse } from './geminiProvider';

/**
 * Fetches a JSON stream, parses it, calls a callback for progressive
 * updates of the "story" field, and returns the full parsed JSON object.
 * Handles JSON enclosed in ```json ... ``` markers OR starting directly with {.
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
	storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void,
	thoughtUpdateCallback?: (thoughtChunk: string, isComplete: boolean) => void
): Promise<object | undefined> {
	let finalJsonObject: any = null;
	let jsonStarted = false;
	let markerFound = false; // Track if ```json marker was explicitly found
	let accumulatedRawText = '';
	let accumulatedJsonText = '';
	// Buffer to hold potential start-of-marker/brace chars from the *end* of the previous chunk
	let pendingPrefixCheck = '';
	const MAX_MARKER_PREFIX_LEN = 8; // Length of "```json\n"

	if (typeof storyUpdateCallback !== 'function') {
		console.error('Error: storyUpdateCallback must be a function.');
		throw new Error('storyUpdateCallback must be a function.');
	}

	// Use emitPartialTokens to get story updates faster
	const liveParser = new JSONParser({ emitPartialValues: true, emitPartialTokens: true });

	const liveParserPromise = new Promise<void>((resolve) => {
		liveParser.onValue = ({ value, key, partial }) => {
			// console.log('LiveParser Value:', { key, value, partial }); // Debugging
			try {
				// Send partial story updates as they come
				if (key === 'story' && typeof value === 'string') {
					storyUpdateCallback(value, !partial);
				}
				// Store the complete object structure as it builds (optional)
				// Note: This might store incomplete objects if the stream stops early
				// finalJsonObject = value; // Re-enabled final parsing later for robustness
			} catch (callbackError) {
				console.error('Error inside storyUpdateCallback:', callbackError);
			}
		};
		liveParser.onError = (err) => {
			// Don't reject the promise here, just log. Final parsing will catch errors.
			console.warn('Live JSON Parser Error:', err.message);
			// No resolve() here - let onEnd handle it
		};
		liveParser.onEnd = () => {
			console.log('--> Live parser finished processing input.');
			resolve(); // Resolve the promise when the parser finishes
		};
	});

	const geminiStreamResult = (await llm.generateContent(
		request
	)) as unknown as AsyncGenerator<GenerateContentResponse>;
	if (!geminiStreamResult || typeof geminiStreamResult[Symbol.asyncIterator] !== 'function') {
		console.error('Failed to get a valid stream from generateContent.');
		throw new Error('Invalid stream response from LLM.');
	}

	try {
		console.log('--- Starting processing Gemini stream ---');
		for await (const chunk of geminiStreamResult) {
			const thoughts = getThoughtsFromResponse(chunk as GenerateContentResponse);
			if (thoughts) {
				if (thoughtUpdateCallback && typeof thoughtUpdateCallback === 'function') {
					// Call the thought update callback with the current thoughts
					thoughtUpdateCallback(thoughts, false);
				}
				continue; // Skip to the next chunk if this is a thought update
			}
			const chunkText = chunk?.text;
			if (typeof chunkText !== 'string') continue; // Skip invalid chunks more robustly
			accumulatedRawText += chunkText;
			if (chunkText.length === 0) continue; // Skip empty chunks

			const textToProcess = chunkText; // The current chunk's text
			if (!jsonStarted) {
				// Combine pending prefix with current chunk for searching
				const effectiveSearchText = pendingPrefixCheck + textToProcess;
				let jsonContentStartIndexInOriginal = -1; // Index in the original textToProcess

				// --- Strategy 1: Look for ```json marker ---
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
					// Marker FOUND
					markerFound = true; // Mark that we found the explicit marker
					jsonStarted = true;
					const jsonContentStartIndexInEffective = markerIndex + markerLength;
					jsonContentStartIndexInOriginal = Math.max(
						0,
						jsonContentStartIndexInEffective - pendingPrefixCheck.length
					);
					pendingPrefixCheck = ''; // Clear the pending buffer
					console.log('--> JSON started via ```json marker.');
				} else {
					// --- Strategy 2: Look for the first '{' as fallback ---
					const braceIndex = effectiveSearchText.indexOf('{');
					if (braceIndex !== -1) {
						// Found '{' before finding ```json
						markerFound = false; // Explicitly note marker wasn't used
						jsonStarted = true;
						const jsonContentStartIndexInEffective = braceIndex;
						jsonContentStartIndexInOriginal = Math.max(
							0,
							jsonContentStartIndexInEffective - pendingPrefixCheck.length
						);
						pendingPrefixCheck = ''; // Clear the pending buffer
						console.log("--> JSON started via fallback '{' detection.");
					} else {
						// --- Neither marker nor '{' found yet ---
						// Update pendingPrefixCheck for the next iteration.
						// Store the tail end that could be a prefix of ```json\n or contain {
						pendingPrefixCheck = effectiveSearchText.substring(
							Math.max(0, effectiveSearchText.length - MAX_MARKER_PREFIX_LEN)
						);
						// Optimization: Trim pending check if it definitely can't start ```json or {
						let validPrefix = '';
						for (let i = Math.min(pendingPrefixCheck.length, MAX_MARKER_PREFIX_LEN); i > 0; i--) {
							const prefix = pendingPrefixCheck.substring(pendingPrefixCheck.length - i);
							if (markerWithNewline.startsWith(prefix) || prefix.includes('{')) {
								validPrefix = prefix;
								break;
							}
						}
						if (
							pendingPrefixCheck.length > 0 &&
							!validPrefix &&
							!pendingPrefixCheck.includes('{')
						) {
							// If the end doesn't contain { and isn't a prefix of ```json, reset it
							// Keep the last char in case it's the start of {
							pendingPrefixCheck = pendingPrefixCheck.slice(-1).includes('{')
								? pendingPrefixCheck.slice(-1)
								: '';
						} else {
							pendingPrefixCheck =
								validPrefix ||
								(pendingPrefixCheck.includes('{')
									? pendingPrefixCheck.substring(pendingPrefixCheck.indexOf('{'))
									: '');
						}

						// console.log("Marker/Brace not found, pending prefix:", pendingPrefixCheck); // Debugging
						continue; // Skip to the next chunk, nothing to parse yet
					}
				}

				// --- Process JSON part found in *this* chunk (if any) ---
				if (jsonStarted && jsonContentStartIndexInOriginal !== -1) {
					const jsonPartInCurrentChunk = textToProcess.substring(jsonContentStartIndexInOriginal);
					if (jsonPartInCurrentChunk.length > 0) {
						accumulatedJsonText += jsonPartInCurrentChunk;
						try {
							// console.log(`Writing to parser (initial): "${jsonPartInCurrentChunk}"`); // Debug
							liveParser.write(jsonPartInCurrentChunk);
						} catch (liveParserWriteError) {
							console.warn(
								'Live JSON Parser Write Error (Initial):',
								(liveParserWriteError as Error).message
							);
						}
					}
				}
			} else {
				// --- JSON already started in a previous chunk, process the whole current chunk ---
				if (textToProcess.length > 0) {
					accumulatedJsonText += textToProcess;
					try {
						// console.log(`Writing to parser (subsequent): "${textToProcess}"`); // Debug
						liveParser.write(textToProcess);
					} catch (liveParserWriteError) {
						console.warn(
							'Live JSON Parser Write Error (Subsequent):',
							(liveParserWriteError as Error).message
						);
					}
				}
			}
		} // End of stream loop

		console.log('--- Gemini stream ended ---');
		liveParser.end(); // Signal end of input to the parser
		await liveParserPromise; // Wait for the parser to finish processing buffered data

		// --- Final Cleaning and Parsing ---
		console.log('--- Performing final cleaning and parsing ---');
		let cleanedJsonText = accumulatedJsonText;

		// 1. Remove trailing ``` marker ONLY if the ```json marker was found initially
		const endMarker = '```';
		if (markerFound) {
			// Check if it ends with ``` possibly followed by whitespace
			const trimmedEnd = cleanedJsonText.trimEnd();
			if (trimmedEnd.endsWith(endMarker)) {
				cleanedJsonText = trimmedEnd.substring(0, trimmedEnd.length - endMarker.length).trimEnd();
				console.log("--> Removed trailing '```' marker.");
			} else {
				// Check if the raw text ended with it, even if not in accumulated
				if (accumulatedRawText.trimEnd().endsWith(endMarker)) {
					console.warn(
						"Trailing '```' marker found in raw text but not cleanly at the end of accumulated JSON (potentially truncated stream or parse error?). Final JSON might be incomplete."
					);
					// Attempt cleanup based on raw text end (less reliable)
					// This is risky, might cut valid JSON if ``` appeared legitimately earlier
					// cleanedJsonText = cleanedJsonText.substring(0, cleanedJsonText.lastIndexOf(endMarker)).trimEnd();
				} else {
					console.warn(
						"Trailing '```' marker was expected (due to ```json start) but not found at the end."
					);
				}
			}
		} else {
			console.log(
				"--> Skipping trailing '```' removal because initial '```json' marker was not found."
			);
		}

		// 2. Final trim
		cleanedJsonText = cleanedJsonText.trim();

		// 3. Basic validation & Final Parse
		if (cleanedJsonText.length === 0) {
			if (accumulatedRawText.trim().length > 0) {
				console.warn(
					'Cleaned JSON text is empty, but raw text was not. Check marker/brace detection and stripping logic.'
				);
				console.warn(
					'Raw text sample:',
					accumulatedRawText.substring(0, 200) + (accumulatedRawText.length > 200 ? '...' : '')
				);
			} else {
				console.warn('Cleaned JSON text is empty, and raw text was also empty or whitespace.');
			}
			storyUpdateCallback('', true); // Ensure final empty update
			return undefined;
		}

		if (!cleanedJsonText.startsWith('{') || !cleanedJsonText.endsWith('}')) {
			// This can happen with partial parses if emitPartialValues is on and stream cuts early
			console.warn(
				"Cleaned text doesn't start with '{' or end with '}'. Final parse might fail or represent incomplete JSON."
			);
		}

		try {
			cleanedJsonText = cleanedJsonText.replaceAll('```', '').trim(); // Remove any stray ``` markers
			finalJsonObject = JSON.parse(cleanedJsonText);
			console.log('--> Final JSON object successfully parsed after cleaning.');

			// Ensure the final story state is sent via callback
			const finalStory = typeof finalJsonObject?.story === 'string' ? finalJsonObject.story : '';
			// Check if the callback already received the final chunk via partial updates
			// This is tricky; maybe always send the final update for certainty.
			// Let's always send the final update from the fully parsed object.
			storyUpdateCallback(finalStory, true);

			return finalJsonObject;
		} catch (parseError) {
			console.error('--- FINAL JSON PARSE FAILED ---');
			console.error('Error:', (parseError as Error).message);
			console.error('Marker found initially:', markerFound);
			console.error('Cleaned JSON Text:\n', cleanedJsonText);
			// Log raw text only if significantly different or for more context
			// if (cleanedJsonText !== accumulatedRawText) {
			// 	console.error(
			// 		'Full Raw Text (first 500 chars):\n',
			// 		accumulatedRawText.substring(0, 500) + (accumulatedRawText.length > 500 ? '...' : '')
			// 	);
			// }

			try {
				// Try sending error message via callback, but use raw text if JSON is unusable
				const errorStory = accumulatedJsonText.includes('"story"')
					? finalJsonObject?.story || ''
					: `<p>Error: Failed to parse the final JSON response. Raw output might contain partial story.</p><pre>${accumulatedRawText.substring(0, 500)}...</pre>`;
				storyUpdateCallback(errorStory, true);
			} catch (cbError) {
				console.error(
					'Error calling storyUpdateCallback during final parse error handling:',
					cbError
				);
			}
			// Re-throw the error so the caller knows parsing failed
			throw new Error(`Failed to parse final JSON: ${(parseError as Error).message}`);
		}
	} catch (streamError) {
		console.error('Error processing Gemini stream:', streamError);
		try {
			// Send error via callback
			storyUpdateCallback(
				`<p>Error reading response stream: ${(streamError as Error).message}</p>`,
				true
			);
		} catch (cbError) {
			console.error('Error calling storyUpdateCallback during stream error handling:', cbError);
		}
		throw streamError; // Re-throw
	}
}
