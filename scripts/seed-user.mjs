/**
 * Creates the initial user in data/users.json.
 * Run once: node scripts/seed-user.mjs
 *
 * Password is hashed with Argon2id — the original is never stored.
 */
import { hash } from '@node-rs/argon2'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.join(__dir, '..')
const FILE  = path.join(ROOT, 'data', 'users.json')

const EMAIL    = 'kunalpk007@gmail.com'
const PASSWORD = 'Test@1234'

// Security question for this seed user (can be changed via reset-password page)
const QUESTION = "What is the name of your first pet?"
const ANSWER   = "planner"  // change this to your real answer

const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 }

async function sha256(str) {
  return createHash('sha256').update(str).digest('hex')
}

async function main() {
  // Read existing users
  let users = []
  if (existsSync(FILE)) {
    users = JSON.parse(readFileSync(FILE, 'utf-8'))
  }

  const existing = users.find(u => u.email.toLowerCase() === EMAIL.toLowerCase())
  if (existing) {
    console.log(`User ${EMAIL} already exists (id: ${existing.id}). Skipping.`)
    console.log('To reset the password, use the /reset-password page.')
    return
  }

  console.log(`Hashing password with Argon2id (m=65536, t=3, p=4)…`)
  const passwordHash       = await hash(PASSWORD, ARGON2_OPTIONS)
  const securityAnswerHash = await sha256(ANSWER.toLowerCase())

  const user = {
    id:                 randomUUID(),
    email:              EMAIL.toLowerCase(),
    passwordHash,
    securityQuestion:   QUESTION,
    securityAnswerHash,
    createdAt:          new Date().toISOString(),
  }

  users.push(user)
  mkdirSync(path.dirname(FILE), { recursive: true })
  writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf-8')

  console.log(`✅ User created:`)
  console.log(`   Email:    ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log(`   Hash:     ${passwordHash.slice(0, 40)}…`)
  console.log(``)
  console.log(`   Security question: ${QUESTION}`)
  console.log(`   Answer (for reset): "${ANSWER}" — change this to your real answer`)
}

main().catch(err => { console.error(err); process.exit(1) })
