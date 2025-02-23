import Dexie, { liveQuery, type Observable } from 'dexie';
import type { LLM } from '$lib/ai/llm';
import { TaskType } from '@google/generative-ai';

export interface MemoryRecord {
	id?: number;
	memory: string;
	embedding: number[];
}

class MemoryDB extends Dexie {
	memories: Dexie.Table<MemoryRecord, number>;

	constructor() {
		super('InfiniteTalesDB');
		this.version(1).stores({
			// The table "memories" has an auto-increment primary key "id"
			// and we index the "memory" field for quick lookups.
			memories: '++id, memory'
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
	async saveMemory(memory: string) {
		const embedding = await this.llm.embedContent(memory, TaskType.RETRIEVAL_DOCUMENT);
		await this.db.memories.add({ memory, embedding });
		console.log('Memory saved:', { memory, embedding });
	}

	async clearMemories() {
		await this.db.memories.clear();
		console.log('All memories cleared.');
	}

	/**
	 * Deletes memory entries that exactly match the provided memory string.
	 */
	async deleteMemory(memory: string) {
		const deletedCount = await this.db.memories.where('memory').equals(memory).delete();
		console.log(`Deleted ${deletedCount} memory/memories with text:`, memory);
	}


	async isMemory(memory: string) {
		return await this.db.memories.where('memory').equals(memory).first() !== undefined;
	}

	//todo returns true even if the memory is not in the database
	isMemoryAsObservable(memory: string): Observable<MemoryRecord | undefined> {
		return liveQuery(() => this.db.memories.where('memory').equals(memory).first());
	}


	/**
	 * Retrieves up to 3 best related memories by first generating an embedding
	 * for the input text and then computing cosine similarity with all stored embeddings.
	 * Only memories exceeding the similarity threshold will be returned.
	 *
	 * @returns An array of up to 3 memory records that are most similar to the input text.
	 */
	async getRelatedMemories(text: string, maxResults: number = 3): Promise<string[]> {
		const textEmbedding = await this.llm.embedContent(text, TaskType.RETRIEVAL_QUERY);
		const memories = await this.db.memories.toArray();

		// Compute similarity scores for each memory.
		const scoredMemories = memories.map((record) => {
			return { record, score: cosineSimilarity(textEmbedding, record.embedding) };
		});

		scoredMemories.sort((a, b) => b.score - a.score);
		//log the similarity scores with the memory
		console.log(
			'Similarity scores:',
			scoredMemories.map((item) => (JSON.stringify({ score: item.score, memory: item.record.memory })))
		);

		const similarityThreshold = 0.68;
		const bestMatches = scoredMemories
			.filter((item) => item.score >= similarityThreshold)
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
