import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const HOST = process.env.MEDQCM_API_HOST ?? '127.0.0.1'
const PORT = Number(process.env.MEDQCM_API_PORT ?? 3001)
const DATA_DIR = path.resolve('server/data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')
const MAX_BODY = 40 * 1024 * 1024

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function isDatabase(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.users) &&
    Array.isArray(value.requests) &&
    Array.isArray(value.subjects) &&
    Array.isArray(value.assignments) &&
    Array.isArray(value.questions) &&
    Array.isArray(value.attempts)
  )
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readDatabase() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const value = JSON.parse(raw)
    return isDatabase(value) ? value : null
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeDatabase(database) {
  await ensureDataDir()
  const temporary = `${DATA_FILE}.${process.pid}.tmp`
  await fs.writeFile(temporary, JSON.stringify(database), 'utf8')
  await fs.rename(temporary, DATA_FILE)
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, PUT, OPTIONS',
        'access-control-allow-headers': 'content-type',
      })
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (url.pathname === '/api/health' && req.method === 'GET') {
      send(res, 200, { ok: true, storage: 'server/data/db.json' })
      return
    }

    if (url.pathname === '/api/db' && req.method === 'GET') {
      const database = await readDatabase()
      if (!database) {
        send(res, 404, { error: 'not_seeded' })
        return
      }
      send(res, 200, database)
      return
    }

    if (url.pathname === '/api/db' && req.method === 'PUT') {
      const raw = await readBody(req)
      let database
      try {
        database = JSON.parse(raw)
      } catch {
        send(res, 400, { error: 'invalid_json' })
        return
      }
      if (!isDatabase(database)) {
        send(res, 400, { error: 'invalid_database' })
        return
      }
      await writeDatabase(database)
      send(res, 200, { ok: true })
      return
    }

    send(res, 404, { error: 'not_found' })
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') {
      send(res, 413, { error: 'payload_too_large' })
      return
    }
    console.error('[medqcm-api]', error)
    send(res, 500, { error: 'internal_error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[medqcm-api] http://${HOST}:${PORT} — données partagées : ${DATA_FILE}`)
})
