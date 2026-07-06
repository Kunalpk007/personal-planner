import 'server-only'
import fs   from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

export interface StoredUser {
  id:                 string
  email:              string
  passwordHash:       string
  securityQuestion:   string | null
  securityAnswerHash: string | null
  createdAt:          string
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await readUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const users = await readUsers()
  return users.find(u => u.id === id) ?? null
}

export async function createUser(
  email: string,
  passwordHash: string,
  securityQuestion: string | null,
  securityAnswerHash: string | null,
): Promise<StoredUser> {
  const users = await readUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already registered')
  }
  const user: StoredUser = {
    id:                 randomUUID(),
    email:              email.toLowerCase().trim(),
    passwordHash,
    securityQuestion,
    securityAnswerHash,
    createdAt:          new Date().toISOString(),
  }
  users.push(user)
  await writeUsers(users)
  return user
}

export async function updatePassword(
  userId: string,
  newPasswordHash: string,
): Promise<void> {
  const users = await readUsers()
  const idx = users.findIndex(u => u.id === userId)
  if (idx === -1) throw new Error('User not found')
  users[idx].passwordHash = newPasswordHash
  await writeUsers(users)
}
