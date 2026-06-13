// Minimal in-memory localStorage polyfill so zustand's `persist` middleware
// (which the store unconditionally reads/writes) doesn't throw in Node.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() { return this.store.size }
  getItem(key: string)  { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MemoryStorage()
}
