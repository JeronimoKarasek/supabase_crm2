import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') { 
  return NextResponse.json({ error: msg }, { status: 401 }) 
}

function badRequest(msg = 'Bad Request') { 
  return NextResponse.json({ error: msg }, { status: 400 }) 
}

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

/**
 * POST /api/companies/create
 * 
 * Cria uma nova empresa e um usuário administrador para ela
 * 
 * Body:
 * {
 *   company: {
 *     name: string (obrigatório),
 *     cnpj: string (opcional),
 *     phone: string (opcional),
 *     email: string (opcional),
 *     address: string (opcional)
 *   },
 *   user: {
 *     email: string (obrigatório),
 *     password: string (obrigatório, mínimo 6 caracteres),
 *     name: string (obrigatório),
 *     phone: string (opcional)
 *   }
 * }
 * 
 * Retorna:
 * {
 *   success: true,
 *   company: { id, name, ... },
 *   user: { id, email, ... }
 * }
 */
export async function POST(request) {
  try {
    // Verificar API Key interna para chamadas externas
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return unauthorized('API Key inválida ou não fornecida')
    }

    console.log('🏢 [Create Company] External API call with valid key')

    // Parse body
    const body = await request.json()
    const { company, user: newUser } = body

    // Validações
    if (!company?.name) {
      return badRequest('Nome da empresa é obrigatório')
    }
    if (!newUser?.email) {
      return badRequest('Email do usuário é obrigatório')
    }
    if (!newUser?.password) {
      return badRequest('Senha do usuário é obrigatória')
    }
    if (newUser.password.length < 6) {
      return badRequest('Senha deve ter no mínimo 6 caracteres')
    }
    if (!newUser?.name) {
      return badRequest('Nome do usuário é obrigatório')
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newUser.email)) {
      return badRequest('Email inválido')
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', newUser.email)
      .single()

    if (existingUser) {
      return badRequest('Email já está em uso')
    }

    console.log('🏢 [Create Company] Creating company:', company.name)

    // 1. Criar empresa na tabela companies (deixa o DB usar DEFAULT para active/timestamps)
    const companyInsert = {
      name: company.name
    }
    if (company.cnpj) companyInsert.cnpj = company.cnpj
    if (company.phone) companyInsert.phone = company.phone
    if (company.email) companyInsert.email = company.email
    if (company.address) companyInsert.address = company.address

    let { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert(companyInsert)
      .select()
      .single()

    // Retry logic for account_id NOT NULL or missing
    if (companyError) {
      const msg = companyError?.message || ''
      console.warn('⚠️  [Create Company] Insert failed, checking for account_id requirement:', msg)
      const needsAccountId = /account_id/i.test(msg) && (/not-null|null value/i.test(msg) || /violates not-null/i.test(msg))
      if (needsAccountId) {
        // Try with UUID string first (works for uuid or text types)
        const retryInsert = { ...companyInsert, account_id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}`) }
        const retry1 = await supabaseAdmin
          .from('companies')
          .insert(retryInsert)
          .select()
          .single()
        companyData = retry1.data
        companyError = retry1.error

        // If still failing and message indicates integer type, try with 0
        if (companyError && /account_id/i.test(companyError.message) && /integer/i.test(companyError.message)) {
          const retryInsertInt = { ...companyInsert, account_id: 0 }
          const retry2 = await supabaseAdmin
            .from('companies')
            .insert(retryInsertInt)
            .select()
            .single()
          companyData = retry2.data
          companyError = retry2.error
        }
      }
    }

    if (companyError) {
      console.error('❌ [Create Company] Error creating company:', companyError)
      return NextResponse.json({ 
        error: 'Erro ao criar empresa', 
        details: companyError.message 
      }, { status: 500 })
    }

    console.log('✅ [Create Company] Company created:', companyData.id)
    console.log('👤 [Create Company] Creating user:', newUser.email)

    // 2. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: newUser.email,
      password: newUser.password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        name: newUser.name,
        phone: newUser.phone || null,
        role: 'admin', // Admin da empresa
        company_id: companyData.id
      }
    })

    if (authError) {
      console.error('❌ [Create Company] Error creating auth user:', authError)
      // Rollback: deletar empresa criada
      await supabaseAdmin.from('companies').delete().eq('id', companyData.id)
      return NextResponse.json({ 
        error: 'Erro ao criar usuário', 
        details: authError.message 
      }, { status: 500 })
    }

    console.log('✅ [Create Company] Auth user created:', authData.user.id)

    // 3. Criar registro na tabela users (deixa o DB usar DEFAULT para active/timestamps)
    const userInsert = {
      id: authData.user.id,
      email: newUser.email,
      name: newUser.name,
      role: 'admin',
      company_id: companyData.id
    }
    if (newUser.phone) userInsert.phone = newUser.phone

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert(userInsert)
      .select()
      .single()

    if (userError) {
      console.error('❌ [Create Company] Error creating user record:', userError)
      // Rollback: deletar usuário auth e empresa
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', companyData.id)
      return NextResponse.json({ 
        error: 'Erro ao criar registro de usuário', 
        details: userError.message 
      }, { status: 500 })
    }

    console.log('✅ [Create Company] User record created:', userData.id)
    console.log('🎉 [Create Company] Success! Company:', companyData.id, 'User:', userData.id)

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: 'Empresa e usuário criados com sucesso',
      company: {
        id: companyData.id,
        name: companyData.name,
        cnpj: companyData.cnpj,
        phone: companyData.phone,
        email: companyData.email,
        address: companyData.address,
        active: companyData.active,
        created_at: companyData.created_at
      },
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        company_id: userData.company_id,
        active: userData.active,
        created_at: userData.created_at
      }
    })

  } catch (error) {
    console.error('❌ [Create Company] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    }, { status: 500 })
  }
}
