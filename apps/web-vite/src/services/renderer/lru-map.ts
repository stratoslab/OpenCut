export class LRUMap<K, V> {
	private map = new Map<K, { value: V; lastAccessed: number }>();
	private accessOrder: K[] = [];
	private _maxSize: number;

	constructor(maxSize: number) {
		this._maxSize = maxSize;
	}

	get maxSize(): number {
		return this._maxSize;
	}

	set maxSize(size: number) {
		this._maxSize = size;
		this.evictToSize();
	}

	get size(): number {
		return this.map.size;
	}

	get(key: K): V | undefined {
		const entry = this.map.get(key);
		if (!entry) return undefined;
		this.touch(key);
		return entry.value;
	}

	set(key: K, value: V): void {
		if (this.map.has(key)) {
			this.map.set(key, { value, lastAccessed: Date.now() });
			this.touch(key);
			return;
		}

		if (this.map.size >= this._maxSize) {
			this.evictOldest();
		}

		this.map.set(key, { value, lastAccessed: Date.now() });
		this.accessOrder.push(key);
	}

	delete(key: K): boolean {
		if (!this.map.has(key)) return false;
		this.map.delete(key);
		this.accessOrder = this.accessOrder.filter(k => k !== key);
		return true;
	}

	has(key: K): boolean {
		return this.map.has(key);
	}

	clear(): void {
		this.map.clear();
		this.accessOrder = [];
	}

	private touch(key: K): void {
		this.accessOrder = this.accessOrder.filter(k => k !== key);
		this.accessOrder.push(key);
	}

	private evictOldest(): void {
		if (this.accessOrder.length === 0) return;
		const oldest = this.accessOrder.shift()!;
		this.map.delete(oldest);
	}

	private evictToSize(): void {
		while (this.map.size > this._maxSize && this.accessOrder.length > 0) {
			this.evictOldest();
		}
	}

	keys(): K[] {
		return [...this.accessOrder];
	}
}
