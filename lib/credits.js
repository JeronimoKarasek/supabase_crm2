// Credits helpers over Redis. Store balances in cents (integers).
const { get, set, incrby, decrby, mode } = require('./redis')
const creditsDb = require('./credits-db')

// Chaves: manter compat retro, mas permitir escopo empresa
const KEY_USER = (userId) => `cr:bal:u:${userId}`
const KEY_EMPRESA = (empresaId) => `cr:bal:e:${empresaId}`

function resolveKey(userId, empresaId) {
  if (empresaId) return KEY_EMPRESA(empresaId)
  return KEY_USER(userId)
}

// Use Supabase as fallback if Redis is in memory mode
const useDbFallback = mode === 'memory'

if (useDbFallback) {
  console.log('[Credits] Redis em memória detectado - usando Supabase como persistência')
}

function toCents(amount) {
  if (typeof amount === 'number') return Math.round(amount * 100)
  if (typeof amount === 'string') return Math.round(parseFloat(amount.replace(',', '.')) * 100)
  return 0
}

function formatBRL(cents) {
  const v = (Number(cents || 0) / 100)
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function getBalanceCents(userId, empresaId=null) {
  if (empresaId) {
    // TODO: se usar DB central para empresa, consultar tabela empresa (fora do Redis)
  }
  if (useDbFallback) {
    return creditsDb.getBalanceFromDb(userId) // fallback mantém por usuário até migrar
  }
  const raw = await get(resolveKey(userId, empresaId))
  const n = Number(raw || 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function setBalanceCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    await creditsDb.setBalanceInDb(userId, finalCents)
    return
  }
  await set(resolveKey(userId, empresaId), String(finalCents))
}

async function addCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    return creditsDb.addToBalanceInDb(userId, finalCents)
  }
  return incrby(resolveKey(userId, empresaId), finalCents)
}

async function chargeCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    return creditsDb.chargeFromBalanceInDb(userId, finalCents)
  }
  return decrby(resolveKey(userId, empresaId), finalCents)
}

// Check if user has sufficient balance (does not deduct)
async function hasSufficientBalance(userId, cents, empresaId=null) {
  const balance = await getBalanceCents(userId, empresaId)
  const required = Math.round(Number(cents || 0))
  return balance >= required
}

// Charge with validation (returns { success, newBalance, error })
async function chargeWithValidation(userId, cents, empresaId=null) {
  const required = Math.round(Number(cents || 0))
  const balance = await getBalanceCents(userId, empresaId)
  
  if (balance < required) {
    return {
      success: false,
      newBalance: balance,
      error: 'Saldo insuficiente'
    }
  }
  
  const newBalance = await chargeCents(userId, required, empresaId)
  return {
    success: true,
    newBalance,
    error: null
  }
}

module.exports = {
  toCents,
  formatBRL,
  getBalanceCents,
  setBalanceCents,
  addCents,
  chargeCents,
  hasSufficientBalance,
  chargeWithValidation,
}
