// Lightweight Redis client with Upstash (HTTP) or classic Redis (ioredis) fallback.
// Usage: configure either
//  - UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (recommended for serverless)
//  - or REDIS_URL (redis://:password@host:port) / REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
// If nothing configured, falls back to in-memory Map (best-effort, not for production).

let mode = 'memory'
let client = null

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
const hasRedisUrl = !!process.env.REDIS_URL
const hasRedisHost = !!process.env.REDIS_HOST

if (hasUpstash) {
  try {
    // Lazy import to avoid bundling on edge if not used
    const { Redis } = require('@upstash/redis')
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    mode = 'upstash'
  } catch (e) {
    console.warn('Upstash Redis not available, falling back:', e?.message)
  }
}

if (!client && (hasRedisUrl || hasRedisHost)) {
  try {
    const IORedis = require('ioredis')
    client = hasRedisUrl
      ? new IORedis(process.env.REDIS_URL)
      : new IORedis({
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          tls: process.env.REDIS_TLS === '1' ? {} : undefined,
        })
    mode = 'ioredis'
  } catch (e) {
    console.warn('ioredis not available, falling back:', e?.message)
  }
}

const memory = new Map()

async function get(key) {
  if (mode === 'upstash') return client.get(key)
  if (mode === 'ioredis') return client.get(key)
  return memory.get(key)
}

async function set(key, value, ttlSec) {
  if (mode === 'upstash') {
    if (ttlSec) return client.set(key, value, { ex: ttlSec })
    return client.set(key, value)
  }
  if (mode === 'ioredis') {
    if (ttlSec) return client.set(key, value, 'EX', ttlSec)
    return client.set(key, value)
  }
  memory.set(key, value)
}

async function del(key) {
  if (mode === 'upstash') return client.del(key)
  if (mode === 'ioredis') return client.del(key)
  memory.delete(key)
}

async function incr(key) {
  if (mode === 'upstash' || mode === 'ioredis') return client.incr(key)
  const v = Number(memory.get(key) || 0) + 1
  memory.set(key, String(v))
  return v
}

// Set if not exists with TTL; returns true if set, false if already exists
async function setNX(key, ttlSec = 60) {
  if (mode === 'upstash') {
    const res = await client.set(key, '1', { nx: true, ex: ttlSec })
    return res === 'OK'
  }
  if (mode === 'ioredis') {
    const res = await client.set(key, '1', 'EX', ttlSec, 'NX')
    return res === 'OK'
  }
  if (memory.has(key)) return false
  memory.set(key, '1')
  setTimeout(() => memory.delete(key), ttlSec * 1000).unref?.()
  return true
}

module.exports = {
  mode,
  get,
  set,
  del,
  incr,
  setNX,
}
