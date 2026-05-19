import type { VoiceProfile } from "@/ai/voiceover";

// SpeakerDescriptor is the JSON-serializable object returned by OuteTTS
// create_speaker(). It contains per-word audio token sequences that condition
// synthesis on the reference speaker's voice characteristics.
export type SpeakerDescriptor = Record<string, unknown>;

export interface ClonedVoice extends VoiceProfile {
	isCloned: true;
	createdAt: number;
	descriptorId: string; // FK → speaker-descriptors store
}

const DB_NAME = "opencut-tts";
const DB_VERSION = 1;

const STORE_CLONED_VOICES = "cloned-voices";
const STORE_SPEAKER_DESCRIPTORS = "speaker-descriptors";

/**
 * Opens (or creates) the `opencut-tts` IndexedDB database at version 1.
 * Creates the `cloned-voices` and `speaker-descriptors` object stores on first
 * run (or after a version upgrade).
 */
export function openTTSDatabase(): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			if (!db.objectStoreNames.contains(STORE_CLONED_VOICES)) {
				db.createObjectStore(STORE_CLONED_VOICES, { keyPath: "id" });
			}

			if (!db.objectStoreNames.contains(STORE_SPEAKER_DESCRIPTORS)) {
				db.createObjectStore(STORE_SPEAKER_DESCRIPTORS, { keyPath: "id" });
			}
		};

		request.onsuccess = (event) => {
			resolve((event.target as IDBOpenDBRequest).result);
		};

		request.onerror = (event) => {
			const error = (event.target as IDBOpenDBRequest).error;
			reject(new Error(`TTS database open failed: ${error?.message ?? "unknown error"}`));
		};

		request.onblocked = () => {
			reject(new Error("TTS database open blocked: close other tabs using this database"));
		};
	});
}

/**
 * Saves a cloned voice profile and its speaker descriptor to IndexedDB.
 * Both records are written in a single transaction for atomicity.
 */
export async function saveClonedVoice(
	voice: ClonedVoice,
	descriptor: SpeakerDescriptor,
): Promise<void> {
	let db: IDBDatabase;
	try {
		db = await openTTSDatabase();
	} catch (err) {
		const error = err as Error;
		throw new Error(`TTS storage write failed: ${error.message}`);
	}

	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(
			[STORE_CLONED_VOICES, STORE_SPEAKER_DESCRIPTORS],
			"readwrite",
		);

		tx.oncomplete = () => resolve();
		tx.onerror = (event) => {
			const error = (event.target as IDBTransaction).error;
			reject(new Error(`TTS storage write failed: ${error?.message ?? "unknown error"}`));
		};
		tx.onabort = (event) => {
			const error = (event.target as IDBTransaction).error;
			reject(new Error(`TTS storage write failed: ${error?.message ?? "transaction aborted"}`));
		};

		tx.objectStore(STORE_CLONED_VOICES).put(voice);
		tx.objectStore(STORE_SPEAKER_DESCRIPTORS).put({
			id: voice.descriptorId,
			descriptor,
			createdAt: Date.now(),
		});
	});
}

/**
 * Loads all cloned voice profiles and their corresponding speaker descriptors
 * from IndexedDB.
 */
export async function loadAllClonedVoices(): Promise<
	Array<{ voice: ClonedVoice; descriptor: SpeakerDescriptor }>
> {
	let db: IDBDatabase;
	try {
		db = await openTTSDatabase();
	} catch (err) {
		const error = err as Error;
		throw new Error(`TTS storage read failed: ${error.message}`);
	}

	return new Promise<Array<{ voice: ClonedVoice; descriptor: SpeakerDescriptor }>>(
		(resolve, reject) => {
			const tx = db.transaction(
				[STORE_CLONED_VOICES, STORE_SPEAKER_DESCRIPTORS],
				"readonly",
			);

			tx.onerror = (event) => {
				const error = (event.target as IDBTransaction).error;
				reject(new Error(`TTS storage read failed: ${error?.message ?? "unknown error"}`));
			};

			const voicesStore = tx.objectStore(STORE_CLONED_VOICES);
			const descriptorsStore = tx.objectStore(STORE_SPEAKER_DESCRIPTORS);

			const getAllRequest = voicesStore.getAll();

			getAllRequest.onsuccess = () => {
				const voices = getAllRequest.result as ClonedVoice[];
				const results: Array<{ voice: ClonedVoice; descriptor: SpeakerDescriptor }> = [];
				let pending = voices.length;

				if (pending === 0) {
					resolve(results);
					return;
				}

				for (const voice of voices) {
					const getRequest = descriptorsStore.get(voice.descriptorId);

					getRequest.onsuccess = () => {
						const row = getRequest.result as
							| { id: string; descriptor: SpeakerDescriptor; createdAt: number }
							| undefined;

						if (row) {
							results.push({ voice, descriptor: row.descriptor });
						}

						pending -= 1;
						if (pending === 0) {
							resolve(results);
						}
					};

					getRequest.onerror = (event) => {
						const error = (event.target as IDBRequest).error;
						reject(
							new Error(
								`TTS storage read failed: ${error?.message ?? "unknown error"}`,
							),
						);
					};
				}
			};

			getAllRequest.onerror = (event) => {
				const error = (event.target as IDBRequest).error;
				reject(new Error(`TTS storage read failed: ${error?.message ?? "unknown error"}`));
			};
		},
	);
}

/**
 * Deletes a cloned voice and its speaker descriptor from IndexedDB.
 * Both records are removed in a single transaction for atomicity.
 */
export async function deleteClonedVoice(
	voiceId: string,
	descriptorId: string,
): Promise<void> {
	let db: IDBDatabase;
	try {
		db = await openTTSDatabase();
	} catch (err) {
		const error = err as Error;
		throw new Error(`TTS storage delete failed: ${error.message}`);
	}

	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(
			[STORE_CLONED_VOICES, STORE_SPEAKER_DESCRIPTORS],
			"readwrite",
		);

		tx.oncomplete = () => resolve();
		tx.onerror = (event) => {
			const error = (event.target as IDBTransaction).error;
			reject(new Error(`TTS storage delete failed: ${error?.message ?? "unknown error"}`));
		};
		tx.onabort = (event) => {
			const error = (event.target as IDBTransaction).error;
			reject(new Error(`TTS storage delete failed: ${error?.message ?? "transaction aborted"}`));
		};

		tx.objectStore(STORE_CLONED_VOICES).delete(voiceId);
		tx.objectStore(STORE_SPEAKER_DESCRIPTORS).delete(descriptorId);
	});
}
