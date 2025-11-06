// Credits helpers over Redis. Store balances in cents (integers).
const { get, set, incrby, decrby, mode } = require('./redis')
const creditsDb = require('./credits-db')

const KEY = (userId) => `cr:bal:${userId}`

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

async function getBalanceCents(userId) {
  if (useDbFallback) {
    return creditsDb.getBalanceFromDb(userId)
  }
  const raw = await get(KEY(userId))
  const n = Number(raw || 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function setBalanceCents(userId, cents) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    await creditsDb.setBalanceInDb(userId, finalCents)
    return
  }
  await set(KEY(userId), String(finalCents))
}

async function addCents(userId, cents) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    return creditsDb.addToBalanceInDb(userId, finalCents)
  }
  return incrby(KEY(userId), finalCents)
}

async function chargeCents(userId, cents) {
  const finalCents = Math.round(Number(cents || 0))
  if (useDbFallback) {
    return creditsDb.chargeFromBalanceInDb(userId, finalCents)
  }
  return decrby(KEY(userId), finalCents)
}

// Check if user has sufficient balance (does not deduct)
async function hasSufficientBalance(userId, cents) {
  const balance = await getBalanceCents(userId)
  const required = Math.round(Number(cents || 0))
  return balance >= required
}

// Charge with validation (returns { success, newBalance, error })
async function chargeWithValidation(userId, cents) {
  const required = Math.round(Number(cents || 0))
  const balance = await getBalanceCents(userId)
  
  if (balance < required) {
    return {
      success: false,
      newBalance: balance,
      error: 'Saldo insuficiente'
    }
  }
  
  const newBalance = await chargeCents(userId, required)
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
