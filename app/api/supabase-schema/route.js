import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

export async function GET() {
  try {
    // Query para buscar todas as tabelas do schema public
    const { data: tablesData, error: tablesError } = await supabaseAdmin.rpc('get_table_names')
    
    if (tablesError) {
      // Fallback: tentar buscar tabelas conhecidas
      const knownTables = ['Farol', 'product_purchases', 'products', 'global_settings', 'batch_simulations', 'bank_credentials']
      const tables = []
      const columns = {}
      
      // Tentar buscar colunas de cada tabela conhecida
      for (const table of knownTables) {
        try {
          const { data, error } = await supabaseAdmin.from(table).select('*').limit(1)
          if (!error && data !== null) {
            tables.push(table)
            if (data.length > 0) {
              columns[table] = Object.keys(data[0])
            } else {
              // Se não houver dados, tentar buscar estrutura pela metadata
              columns[table] = []
            }
          }
        } catch (e) {
          // Tabela não existe ou sem permissão
          continue
        }
      }
      
      return NextResponse.json({ tables, columns })
    }

    // Se conseguiu buscar tabelas via RPC
    const tables = tablesData || []
    const columns = {}

    // Buscar colunas de cada tabela
    for (const table of tables) {
      try {
        const { data } = await supabaseAdmin.from(table).select('*').limit(1)
        if (data && data.length > 0) {
          columns[table] = Object.keys(data[0])
        } else {
          columns[table] = []
        }
      } catch (e) {
        columns[table] = []
      }
    }

    return NextResponse.json({ tables, columns })
  } catch (error) {
    console.error('Erro ao buscar schema:', error)
    
    // Fallback final com tabelas hardcoded
    return NextResponse.json({
      tables: [
        'Farol',
        'product_purchases',
        'products',
        'global_settings',
        'batch_simulations',
        'bank_credentials',
        'users'
      ],
      columns: {
        'Farol': ['id', 'nome', 'cpf', 'telefone', 'email', 'created_at'],
        'product_purchases': ['id', 'user_id', 'product_key', 'amount', 'status', 'created_at'],
        'products': ['id', 'name', 'key', 'price', 'description', 'created_at'],
        'global_settings': ['id', 'settings', 'created_at', 'updated_at'],
      }
    })
  }
}
