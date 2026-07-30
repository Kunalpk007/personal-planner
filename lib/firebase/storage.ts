import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getClientStorage } from './client'

/** Uploads a recorded voice-note blob and returns its download URL. Requires
 *  Firebase Storage to be enabled on the project + the storage.rules deployed
 *  (see storage.rules). Throws if Storage isn't set up — callers treat that as
 *  best-effort and fall back to speech-to-text / local playback. */
export async function uploadJournalAudio(uid: string, dateKey: string, blob: Blob): Promise<string> {
  const r = ref(getClientStorage(), `journalAudio/${uid}/${dateKey}-${Date.now()}.webm`)
  await uploadBytes(r, blob)
  return getDownloadURL(r)
}
