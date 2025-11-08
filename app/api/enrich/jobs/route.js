import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
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
 * GET /api/enrich/jobs
 * 
 * Listar jobs de enriquecimento do usuário
 */
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

    const { data: jobs, error } = await supabaseAdmin
      .from('enrichment_jobs')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ [Enrich Jobs] Error:', error)
      return NextResponse.json({ 
        error: 'Erro ao listar jobs', 
        details: error.message 
      }, { status: 500 })
    }

    // Calcular progresso
    const jobsWithProgress = jobs.map(job => {
      const percent = job.total_rows > 0 
        ? Math.round((job.processed_rows / job.total_rows) * 100) 
        : 0

      return {
        ...job,
        progress: {
          processed: job.processed_rows || 0,
          total: job.total_rows || 0,
          percent
        }
      }
    })

    return NextResponse.json({ jobs: jobsWithProgress })

  } catch (error) {
    console.error('❌ [Enrich Jobs] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
