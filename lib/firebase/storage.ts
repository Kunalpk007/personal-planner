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

/** Uploads a screenshot/photo attached to a bug report and returns its
 *  download URL. Same best-effort contract as uploadJournalAudio — requires
 *  Firebase Storage to be enabled; callers should catch and fall back to
 *  submitting the report without an image rather than blocking the report. */
export async function uploadBugReportImage(uid: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.slice(0, 8) || 'jpg'
  const r = ref(getClientStorage(), `bugReports/${uid}/${Date.now()}.${ext}`)
  await uploadBytes(r, file)
  return getDownloadURL(r)
}
