import Dexie, { liveQuery, type Observable } from 'dexie';
import type { LLM } from '$lib/ai/llm';
import { TaskType } from '@google/generative-ai';

export interface MemoryRecord {
	memory: string;
	embeddingAsRETRIEVAL_DOCUMENT: number[];
	embeddingAsSEMANTIC_SIMILARITY: number[];
	game_state_id: number;
}

class MemoryDB extends Dexie {
	memories: Dexie.Table<MemoryRecord, string>;

	constructor() {
		super('InfiniteTalesDB');
		this.version(1).stores({
			// The table "memories" has an auto-increment primary key "id"
			// and we index the "memory" field for quick lookups.
			memories: 'memory, game_state_id'
		});
		this.memories = this.table('memories');
	}
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
	const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
	const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
	const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
	return dotProduct / (magA * magB);
}

export class MemoryAgent {
	llm: LLM;
	private db: MemoryDB;

	constructor(llm: LLM) {
		this.llm = llm;
		this.db = new MemoryDB();
	}

	/**
	 * Saves a memory string by first generating its embedding with the provided LLM
	 * and then storing both in the IndexedDB through Dexie.
	 */
	async saveMemory(memory: string, game_state_id?: number) {
		const embeddingAsRETRIEVAL_DOCUMENT = await this.llm.embedContent(
			memory,
			TaskType.RETRIEVAL_DOCUMENT
		);
		const embeddingAsSEMANTIC_SIMILARITY = await this.llm.embedContent(
			memory,
			TaskType.SEMANTIC_SIMILARITY
		);
		await this.db.memories.add({
			memory,
			embeddingAsRETRIEVAL_DOCUMENT,
			embeddingAsSEMANTIC_SIMILARITY,
			game_state_id: game_state_id || -100 //-100 so that it is always considered for retrieval
		});
		console.log('Memory saved:', { memory });
	}

	async clearMemories() {
		await this.db.memories.clear();
		console.log('All memories cleared.');
	}

	/**
	 * Deletes memory entries that exactly match the provided memory string.
	 */
	async deleteMemoryByMemory(memory: string) {
		const deletedCount = await this.db.memories.where('memory').equals(memory).delete();
		console.log(`Deleted ${deletedCount} memory/memories with text:`, memory);
	}

	async deleteMemoryByGameStateId(game_state_id: number) {
		const deletedCount = await this.db.memories
			.where('game_state_id')
			.equals(game_state_id)
			.delete();
		console.log(`Deleted ${deletedCount} memory/memories with game_state_id:`, game_state_id);
	}

	async isMemory(memory: string) {
		return (await this.db.memories.where('memory').equals(memory).first()) !== undefined;
	}

	isMemoryAsObservable(game_state_id: number): Observable<MemoryRecord | undefined> {
		return liveQuery(() => this.db.memories.where('game_state_id').equals(game_state_id).first());
	}

	/**
	 * Retrieves up to 3 best related memories by first generating an embedding
	 * for the input text and then computing cosine similarity with all stored embeddings.
	 * Only memories exceeding the similarity threshold will be returned.
	 *
	 * @returns An array of up to 3 memory records that are most similar to the input text.
	 */
	async getRelatedMemories(
		text: string,
		game_state_id?: number,
		maxResults: number = 3
	): Promise<string[]> {
		// Generate two embeddings for the given text.
		const textEmbeddingAsRETRIEVAL_QUERY = await this.llm.embedContent(
			text,
			TaskType.RETRIEVAL_QUERY
		);
		const textEmbeddingAsSEMANTIC_SIMILARITY = await this.llm.embedContent(
			text,
			TaskType.SEMANTIC_SIMILARITY
		);
		let memories;
		if (game_state_id) {
			//consider only memroies that were created before the current game state
			memories = await this.db.memories
				.where('game_state_id')
				.belowOrEqual(game_state_id - 10)
				.toArray();
		} else {
			memories = await this.db.memories.toArray();
		}

		// For each memory, compute four similarity scores:
		// 1. RET -> RET: retrieval query vs. retrieval document.
		// 2. RET -> SEM: retrieval query vs. semantic similarity embedding.
		// 3. SEM -> SEM: semantic similarity query vs. semantic similarity embedding.
		// 4. SEM -> RET: semantic similarity query vs. retrieval document.
		const scoredMemories = memories.map((record) => {
			const scoreRetToRet = cosineSimilarity(
				textEmbeddingAsRETRIEVAL_QUERY,
				record.embeddingAsRETRIEVAL_DOCUMENT
			);
			const scoreRetToSem = cosineSimilarity(
				textEmbeddingAsRETRIEVAL_QUERY,
				record.embeddingAsSEMANTIC_SIMILARITY
			);
			const scoreSemToSem = cosineSimilarity(
				textEmbeddingAsSEMANTIC_SIMILARITY,
				record.embeddingAsSEMANTIC_SIMILARITY
			);
			const scoreSemToRet = cosineSimilarity(
				textEmbeddingAsSEMANTIC_SIMILARITY,
				record.embeddingAsRETRIEVAL_DOCUMENT
			);

			// Here we average all scores as an example of combining them.
			const highestScore = Math.max(scoreRetToRet, scoreRetToSem, scoreSemToSem, scoreSemToRet);
			return { record, scoreRetToRet, scoreRetToSem, scoreSemToSem, scoreSemToRet, highestScore };
		});

		// Log a table showing each memory with all four scores and their combined average.
		console.table(
			scoredMemories.map((item) => ({
				Text: text,
				Memory: item.record.memory,
				HighestScore: item.highestScore,
				'RET->RET': item.scoreRetToRet,
				'SEM->SEM': item.scoreSemToSem,
				'RET->SEM': item.scoreRetToSem,
				'SEM->RET': item.scoreSemToRet
			}))
		);

		// Sort by the combined score in descending order.
		scoredMemories.sort((a, b) => b.highestScore - a.highestScore);
		const similarityThreshold = 0.5968;
		const bestMatches = scoredMemories
			.filter((item) => item.highestScore >= similarityThreshold)
			.slice(0, maxResults)
			.map((item) => item.record);

		if (bestMatches.length === 0) {
			console.log('No related memory found. Best scores:', scoredMemories);
		} else {
			console.log('Best matching memories:', bestMatches);
		}
		return bestMatches.map((match) => match.memory);
	}
}
