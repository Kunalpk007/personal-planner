let _key: CryptoKey | null = null

export function hasJournalKey(): boolean {
  return _key !== null
}

export function getJournalKey(): CryptoKey | null {
  return _key
}

export function setJournalKey(key: CryptoKey): void {
  _key = key
}

export function clearJournalKey(): void {
  _key = null
}
