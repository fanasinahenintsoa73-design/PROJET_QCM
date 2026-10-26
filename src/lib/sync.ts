import type { Database } from '@/types'
import { getDB, replaceDatabase, subscribe } from '@/lib/db'

const ENDPOINT = '/api/db'
const PULL_INTERVAL = 4_000

let started = false
let applyingRemote = false
let dirty = false
let pushing = false
let lastSynced = ''
let pushTimer: number | null = null

function serialise(database: Database) {
  return JSON.stringify(database)
}

function isValidDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Database>
  return (
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.requests) &&
    Array.isArray(candidate.subjects) &&
    Array.isArray(candidate.assignments) &&
    Array.isArray(candidate.questions) &&
    Array.isArray(candidate.attempts)
  )
}

async function request(path: string, init?: RequestInit, timeout = 6_000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(path, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    window.clearTimeout(timer)
  }
}

async function pull() {
  if (dirty || pushing || applyingRemote) return
  try {
    const response = await request(ENDPOINT)
    if (response.status === 404) {
      await pushNow()
      return
    }
    if (!response.ok) return
    const payload: unknown = await response.json()
    if (!isValidDatabase(payload)) return
    const remote = serialise(payload)
    if (remote === lastSynced) return

    const local = serialise(getDB())
    if (remote === local) {
      lastSynced = remote
      return
    }

    applyingRemote = true
    replaceDatabase(payload)
    applyingRemote = false
    lastSynced = remote
  } catch {
    // The API is optional in local-only mode. The next focus/tick retries.
  }
}

async function pushNow() {
  if (pushing) return
  pushing = true
  const payload = serialise(getDB())
  try {
    const response = await request(ENDPOINT, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
    if (response.ok) {
      lastSynced = payload
      if (serialise(getDB()) === payload) dirty = false
    }
  } catch {
    // Keep the local snapshot and retry after the next change or tick.
  } finally {
    pushing = false
  }
}

function schedulePush() {
  if (pushTimer) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    pushTimer = null
    void pushNow()
  }, 450)
}

export async function startSync() {
  if (started || typeof window === 'undefined') return
  started = true

  try {
    const response = await request(ENDPOINT)
    if (response.status === 404) {
      await pushNow()
    } else if (response.ok) {
      const payload: unknown = await response.json()
      if (isValidDatabase(payload)) {
        const remote = serialise(payload)
        const local = serialise(getDB())
        if (remote !== local) {
          applyingRemote = true
          replaceDatabase(payload)
          applyingRemote = false
        }
        lastSynced = remote
      }
    }
  } catch {
    // Continue with the local snapshot when the API is not running.
  }

  subscribe(() => {
    if (applyingRemote) return
    dirty = true
    schedulePush()
  })

  window.setInterval(() => {
    if (dirty) void pushNow()
    else void pull()
  }, PULL_INTERVAL)

  const onWake = () => {
    if (document.visibilityState === 'visible') {
      if (dirty) void pushNow()
      else void pull()
    }
  }
  window.addEventListener('focus', onWake)
  document.addEventListener('visibilitychange', onWake)
}
