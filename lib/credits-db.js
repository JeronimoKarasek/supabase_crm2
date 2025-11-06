// Credits persistence layer using Supabase as fallback when Redis is not configured
const { supabaseAdmin } = require('./supabase-admin')

const TABLE = 'user_credits'

// Ensure table exists (run this once or via migration)
async function ensureTable() {
  // Table structure:
  // - user_id (text, primary key)
  // - balance_cents (bigint)
  // - updated_at (timestamp with time zone)
  
  // This should be created via Supabase dashboard or migration, but we'll try to use it
  // If table doesn't exist, operations will fail gracefully
}

async function getBalanceFromDb(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('balance_cents')
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found (ok)
      console.error('[Credits DB] Error reading balance:', error)
      return 0
    }
    
    return data?.balance_cents || 0
  } catch (e) {
    console.error('[Credits DB] Exception reading balance:', e)
    return 0
  }
}

async function setBalanceInDb(userId, cents) {
  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert({
        user_id: userId,
        balance_cents: Math.round(Number(cents || 0)),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    if (error) {
      console.error('[Credits DB] Error setting balance:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[Credits DB] Exception setting balance:', e)
    return false
  }
}

async function addToBalanceInDb(userId, cents) {
  try {
    // First get current balance
    const current = await getBalanceFromDb(userId)
    const newBalance = current + Math.round(Number(cents || 0))
    await setBalanceInDb(userId, newBalance)
    return newBalance
  } catch (e) {
    console.error('[Credits DB] Exception adding balance:', e)
    return 0
  }
}

async function chargeFromBalanceInDb(userId, cents) {
  try {
    const current = await getBalanceFromDb(userId)
    const newBalance = current - Math.round(Number(cents || 0))
    await setBalanceInDb(userId, newBalance)
    return newBalance
  } catch (e) {
    console.error('[Credits DB] Exception charging balance:', e)
    return 0
  }
}

module.exports = {
  getBalanceFromDb,
  setBalanceInDb,
  addToBalanceInDb,
  chargeFromBalanceInDb,
}
