// Credits helpers over Redis. Store balances in cents (integers).
const { get, set, incrby, decrby, mode } = require('./redis')
const creditsDb = require('./credits-db')
const { supabaseAdmin } = require('./supabase-admin')

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
    if (useDbFallback) {
      try {
        const { data, error } = await supabaseAdmin
          .from('empresa')
          .select('credits')
          .eq('id', empresaId)
          .single()
        if (error) return 0
        // credits é float (reais), converter para cents
        const creditsInReais = Number(data?.credits || 0)
        return Number.isFinite(creditsInReais) ? Math.round(creditsInReais * 100) : 0
      } catch { return 0 }
    }
    const raw = await get(resolveKey(userId, empresaId))
    const n = Number(raw || 0)
    return Number.isFinite(n) ? Math.round(n) : 0
  }
  if (useDbFallback) {
    return creditsDb.getBalanceFromDb(userId) // fallback legado por usuário
  }
  const raw = await get(resolveKey(userId, empresaId))
  const n = Number(raw || 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function setBalanceCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  if (empresaId) {
    if (useDbFallback) {
      // Converter cents para reais (float) para armazenar na coluna 'credits'
      const creditsInReais = finalCents / 100.0
      await supabaseAdmin.from('empresa').update({ credits: creditsInReais, updated_at: new Date().toISOString() }).eq('id', empresaId)
      return
    }
    await set(resolveKey(userId, empresaId), String(finalCents))
    return
  }
  if (useDbFallback) {
    await creditsDb.setBalanceInDb(userId, finalCents)
    return
  }
  await set(resolveKey(userId, empresaId), String(finalCents))
}

async function addCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  if (empresaId) {
    if (useDbFallback) {
      const { data } = await supabaseAdmin.rpc('empresa_add_credits', { p_empresa: empresaId, p_cents: finalCents })
      return Number(data || 0)
    }
    return incrby(resolveKey(userId, empresaId), finalCents)
  }
  if (useDbFallback) {
    return creditsDb.addToBalanceInDb(userId, finalCents)
  }
  return incrby(resolveKey(userId, empresaId), finalCents)
}

async function chargeCents(userId, cents, empresaId=null) {
  const finalCents = Math.round(Number(cents || 0))
  console.log('💰 [Credits] chargeCents chamado:', { userId, cents, finalCents, empresaId, useDbFallback })
  
  if (empresaId) {
    if (useDbFallback) {
      console.log('💰 [Credits] Usando RPC empresa_charge_credits:', { empresaId, finalCents })
      const { data, error } = await supabaseAdmin.rpc('empresa_charge_credits', { p_empresa: empresaId, p_cents: finalCents })
      console.log('💰 [Credits] RPC resultado completo:', { data, error, isArray: Array.isArray(data) })
      
      if (error) {
        console.error('❌ [Credits] RPC erro:', error)
        throw new Error(`RPC Error: ${error.message || JSON.stringify(error)}`)
      }
      
      // RPC retorna array com um objeto { success, new_balance, error }
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0]
        console.log('💰 [Credits] RPC data[0]:', result)
        if (!result.success) {
          throw new Error(result.error || 'Falha ao cobrar')
        }
        return Number(result.new_balance || 0)
      }
      
      console.error('❌ [Credits] RPC retornou formato inesperado:', data)
      throw new Error('Formato de resposta RPC inválido')
    }
    return decrby(resolveKey(userId, empresaId), finalCents)
  }
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
  
  console.log('💰 [Credits] chargeWithValidation:', { userId, empresaId, required, balance, sufficient: balance >= required })
  
  if (balance < required) {
    return {
      success: false,
      newBalance: balance,
      error: 'Saldo insuficiente'
    }
  }
  
  try {
    const newBalance = await chargeCents(userId, required, empresaId)
    console.log('💰 [Credits] Cobrança bem-sucedida, novo saldo:', newBalance)
    return {
      success: true,
      newBalance,
      error: null
    }
  } catch (error) {
    console.error('❌ [Credits] Erro ao cobrar:', error)
    return {
      success: false,
      newBalance: balance,
      error: error.message || 'Erro ao cobrar créditos'
    }
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
