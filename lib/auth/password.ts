/**
 * Argon2id password hashing — PHC winner, OWASP's top recommendation.
 *
 * Parameters chosen to match the OWASP minimum for 2025:
 *   memoryCost = 65536  (64 MB RAM per attempt — cripples GPU/ASIC attacks)
 *   timeCost   = 3      (3 passes over memory)
 *   parallelism = 4     (4 threads)
 *
 * Result: ~200–400 ms on a modern CPU, ~10 ms on GPU (because GPU must
 * allocate 64 MB per parallel attempt, massively limiting parallelism).
 */
import { hash, verify } from '@node-rs/argon2'

const ARGON2_OPTIONS = {
  memoryCost:  65536,
  timeCost:    3,
  parallelism: 4,
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password)
}
