import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getEmpresaForUser(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id, role')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return { empresaId: null, role: 'user' }
    return { empresaId: data?.empresa_id || null, role: data?.role || 'user' }
  } catch {
    return { empresaId: null, role: 'user' }
  }
}

export async function addCreditsToEmpresa(empresaId, cents) {
  const { data, error } = await supabaseAdmin.rpc('empresa_add_credits', { p_empresa: empresaId, p_cents: Math.round(Number(cents||0)) })
  if (error) throw error
  return data
}

export async function chargeCreditsFromEmpresa(empresaId, cents) {
  const { data, error } = await supabaseAdmin.rpc('empresa_charge_credits', { p_empresa: empresaId, p_cents: Math.round(Number(cents||0)) })
  if (error) throw error
  // data is table(success boolean, new_balance bigint, error text)
  if (Array.isArray(data) && data[0]) return data[0]
  return data
}
