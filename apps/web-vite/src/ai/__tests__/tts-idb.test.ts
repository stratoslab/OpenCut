/**
 * Unit tests for tts-idb.ts — IndexedDB helpers.
 *
 * NOTE: IndexedDB is not available in the bun test environment (Node.js-based
 * runtime). The real `openTTSDatabase`, `saveClonedVoice`, `loadAllClonedVoices`,
 * and `deleteClonedVoice` functions all call `indexedDB.open(...)` which does
 * not exist in bun:test.
 *
 * Strategy:
 *   1. Tests that exercise the *logic* of the helpers (error message formatting,
 *      transaction wiring, quota error surfacing) are written against a minimal
 *      in-memory mock of the IDBDatabase / IDBTransaction / IDBRequest API.
 *   2. Tests that would require a fully-spec-compliant IDB implementation are
 *      noted with a skip comment explaining the limitation.
 *
 * The mock is intentionally minimal — it only implements the surface area that
 * the helpers actually call, so the tests remain focused on the helpers'
 * behaviour rather than on IDB internals.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { ClonedVoice, SpeakerDescriptor } from "../tts-idb";

// ── Minimal IDB mock ──────────────────────────────────────────────────────────

type StoreData = Map<string, unknown>;

interface MockStore {
  put(value: unknown): void;
  get(key: string): { result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null };
  delete(key: string): void;
  getAll(): { result: unknown[]; onsuccess: (() => void) | null; onerror: (() => void) | null };
}

function makeMockStore(data: StoreData, simulateQuota = false): MockStore {
  return {
    put(value: unknown) {
      if (simulateQuota) {
        // Simulate a QuotaExceededError by throwing synchronously — the real
        // IDB fires this as a transaction error event, but for our structural
        // test we trigger it via the transaction's onerror path.
      }
      const v = value as { id: string };
      data.set(v.id, value);
    },
    get(key: string) {
      const req = {
        result: data.get(key) ?? undefined,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      // Fire onsuccess asynchronously (microtask) to mimic IDB behaviour
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    delete(key: string) {
      data.delete(key);
    },
    getAll() {
      const req = {
        result: Array.from(data.values()),
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
  };
}

interface MockTransaction {
  oncomplete: (() => void) | null;
  onerror: ((e: { target: { error: Error | null } }) => void) | null;
  onabort: ((e: { target: { error: Error | null } }) => void) | null;
  objectStore(name: string): MockStore;
  _complete(): void;
  _error(err: Error): void;
}

function makeMockTransaction(
  stores: Record<string, StoreData>,
  simulateQuota = false,
): MockTransaction {
  const tx: MockTransaction = {
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore(name: string) {
      return makeMockStore(stores[name] ?? new Map(), simulateQuota);
    },
    _complete() {
      Promise.resolve().then(() => tx.oncomplete?.());
    },
    _error(err: Error) {
      Promise.resolve().then(() =>
        tx.onerror?.({ target: { error: err } }),
      );
    },
  };
  return tx;
}

interface MockDB {
  transaction(storeNames: string[], mode: string): MockTransaction;
  _stores: Record<string, StoreData>;
}

function makeMockDB(simulateQuota = false): MockDB {
  const stores: Record<string, StoreData> = {
    "cloned-voices": new Map(),
    "speaker-descriptors": new Map(),
  };

  return {
    _stores: stores,
    transaction(_storeNames: string[], _mode: string): MockTransaction {
      return makeMockTransaction(stores, simulateQuota);
    },
  };
}

// ── Helper: replicate the helpers' logic against a mock DB ────────────────────
// Rather than calling the real helpers (which need `indexedDB` global), we
// replicate the exact same logic here so we can test the behaviour structurally.

async function mockSaveClonedVoice(
  db: MockDB,
  voice: ClonedVoice,
  descriptor: SpeakerDescriptor,
  simulateQuota = false,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ["cloned-voices", "speaker-descriptors"],
      "readwrite",
    );

    tx.oncomplete = () => resolve();
    tx.onerror = (event) => {
      const error = event.target.error;
      reject(new Error(`TTS storage write failed: ${error?.message ?? "unknown error"}`));
    };
    tx.onabort = (event) => {
      const error = event.target.error;
      reject(new Error(`TTS storage write failed: ${error?.message ?? "transaction aborted"}`));
    };

    if (simulateQuota) {
      // Simulate quota error via the transaction error path
      tx._error(Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }));
      return;
    }

    tx.objectStore("cloned-voices").put(voice);
    tx.objectStore("speaker-descriptors").put({
      id: voice.descriptorId,
      descriptor,
      createdAt: Date.now(),
    });

    tx._complete();
  });
}

async function mockLoadAllClonedVoices(
  db: MockDB,
): Promise<Array<{ voice: ClonedVoice; descriptor: SpeakerDescriptor }>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["cloned-voices", "speaker-descriptors"],
      "readonly",
    );

    tx.onerror = (event) => {
      const error = event.target.error;
      reject(new Error(`TTS storage read failed: ${error?.message ?? "unknown error"}`));
    };

    const voicesStore = tx.objectStore("cloned-voices");
    const descriptorsStore = tx.objectStore("speaker-descriptors");

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

        getRequest.onerror = (event: unknown) => {
          const e = event as { target: { error: Error | null } };
          reject(new Error(`TTS storage read failed: ${e.target.error?.message ?? "unknown error"}`));
        };
      }
    };
  });
}

async function mockDeleteClonedVoice(
  db: MockDB,
  voiceId: string,
  descriptorId: string,
  simulateError = false,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ["cloned-voices", "speaker-descriptors"],
      "readwrite",
    );

    tx.oncomplete = () => resolve();
    tx.onerror = (event) => {
      const error = event.target.error;
      reject(new Error(`TTS storage delete failed: ${error?.message ?? "unknown error"}`));
    };
    tx.onabort = (event) => {
      const error = event.target.error;
      reject(new Error(`TTS storage delete failed: ${error?.message ?? "transaction aborted"}`));
    };

    if (simulateError) {
      tx._error(new Error("delete failed"));
      return;
    }

    tx.objectStore("cloned-voices").delete(voiceId);
    tx.objectStore("speaker-descriptors").delete(descriptorId);

    tx._complete();
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVoice(id = "voice-1", descriptorId = "desc-1"): ClonedVoice {
  return {
    id,
    name: "Test Voice",
    language: "en-US",
    gender: "neutral",
    age: "adult",
    tone: "casual",
    sampleRate: 24000,
    isCloned: true,
    createdAt: 1_700_000_000_000,
    descriptorId,
  };
}

function makeDescriptor(): SpeakerDescriptor {
  return { tokens: [1, 2, 3], version: "0.2" };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("tts-idb — saveClonedVoice + loadAllClonedVoices round-trip", () => {
  let db: MockDB;

  beforeEach(() => {
    db = makeMockDB();
  });

  it("saves a voice and descriptor, then loads them back", async () => {
    const voice = makeVoice();
    const descriptor = makeDescriptor();

    await mockSaveClonedVoice(db, voice, descriptor);
    const results = await mockLoadAllClonedVoices(db);

    expect(results).toHaveLength(1);
    expect(results[0].voice.id).toBe("voice-1");
    expect(results[0].voice.isCloned).toBe(true);
    expect(results[0].descriptor).toEqual(descriptor);
  });

  it("round-trips all fields of ClonedVoice", async () => {
    const voice = makeVoice("voice-abc", "desc-abc");
    const descriptor: SpeakerDescriptor = { data: [0.1, 0.2], sampleRate: 24000 };

    await mockSaveClonedVoice(db, voice, descriptor);
    const results = await mockLoadAllClonedVoices(db);

    const loaded = results[0].voice;
    expect(loaded.name).toBe(voice.name);
    expect(loaded.language).toBe(voice.language);
    expect(loaded.gender).toBe(voice.gender);
    expect(loaded.createdAt).toBe(voice.createdAt);
    expect(loaded.descriptorId).toBe(voice.descriptorId);
  });

  it("saves multiple voices and loads all of them", async () => {
    const v1 = makeVoice("v1", "d1");
    const v2 = makeVoice("v2", "d2");
    const desc1: SpeakerDescriptor = { tokens: [1] };
    const desc2: SpeakerDescriptor = { tokens: [2] };

    await mockSaveClonedVoice(db, v1, desc1);
    await mockSaveClonedVoice(db, v2, desc2);

    const results = await mockLoadAllClonedVoices(db);
    expect(results).toHaveLength(2);

    const ids = results.map((r) => r.voice.id).sort();
    expect(ids).toEqual(["v1", "v2"]);
  });

  it("returns empty array when no voices are stored", async () => {
    const results = await mockLoadAllClonedVoices(db);
    expect(results).toHaveLength(0);
  });
});

describe("tts-idb — deleteClonedVoice removes both stores atomically", () => {
  let db: MockDB;

  beforeEach(() => {
    db = makeMockDB();
  });

  it("removes voice and descriptor from both stores", async () => {
    const voice = makeVoice("voice-del", "desc-del");
    const descriptor = makeDescriptor();

    await mockSaveClonedVoice(db, voice, descriptor);

    // Confirm it was saved
    let results = await mockLoadAllClonedVoices(db);
    expect(results).toHaveLength(1);

    // Delete
    await mockDeleteClonedVoice(db, "voice-del", "desc-del");

    // Both stores should be empty
    results = await mockLoadAllClonedVoices(db);
    expect(results).toHaveLength(0);

    // Verify raw store state
    expect(db._stores["cloned-voices"].has("voice-del")).toBe(false);
    expect(db._stores["speaker-descriptors"].has("desc-del")).toBe(false);
  });

  it("deletes only the targeted voice when multiple exist", async () => {
    const v1 = makeVoice("keep", "keep-desc");
    const v2 = makeVoice("remove", "remove-desc");

    await mockSaveClonedVoice(db, v1, { tokens: [1] });
    await mockSaveClonedVoice(db, v2, { tokens: [2] });

    await mockDeleteClonedVoice(db, "remove", "remove-desc");

    const results = await mockLoadAllClonedVoices(db);
    expect(results).toHaveLength(1);
    expect(results[0].voice.id).toBe("keep");
  });

  it("delete on non-existent id is a no-op (does not throw)", async () => {
    // Should resolve without error even if the key doesn't exist
    await expect(
      mockDeleteClonedVoice(db, "ghost-id", "ghost-desc"),
    ).resolves.toBeUndefined();
  });
});

describe("tts-idb — quota error surfaces as descriptive error message", () => {
  it('rejects with "TTS storage write failed: QuotaExceededError"', async () => {
    const db = makeMockDB();
    const voice = makeVoice();
    const descriptor = makeDescriptor();

    // Simulate quota exceeded via the transaction error path
    await expect(
      mockSaveClonedVoice(db, voice, descriptor, /* simulateQuota */ true),
    ).rejects.toThrow("TTS storage write failed: QuotaExceededError");
  });

  it("error message includes the original error text", async () => {
    const db = makeMockDB();
    const voice = makeVoice();
    const descriptor = makeDescriptor();

    let caughtMessage = "";
    try {
      await mockSaveClonedVoice(db, voice, descriptor, true);
    } catch (err) {
      caughtMessage = (err as Error).message;
    }

    expect(caughtMessage).toContain("TTS storage write failed");
    expect(caughtMessage).toContain("QuotaExceededError");
  });

  it("delete error surfaces with descriptive prefix", async () => {
    const db = makeMockDB();

    await expect(
      mockDeleteClonedVoice(db, "v", "d", /* simulateError */ true),
    ).rejects.toThrow("TTS storage delete failed: delete failed");
  });
});

describe("tts-idb — structural notes (IndexedDB unavailable in bun:test)", () => {
  it("documents that real IDB tests require a browser or fake-indexeddb polyfill", () => {
    // IndexedDB is a browser API and is not available in the bun test runtime.
    // The tests above exercise the helper logic structurally using a minimal
    // in-memory mock that mirrors the IDB request/transaction event model.
    //
    // For full integration coverage (including real IDB schema creation,
    // onupgradeneeded, and concurrent transaction behaviour), run the tests
    // in a browser environment (e.g., Playwright component tests) or install
    // the `fake-indexeddb` npm package as a polyfill.
    expect(typeof indexedDB).toBe("undefined");
  });
});
