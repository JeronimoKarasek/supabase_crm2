import { supabaseAdmin } from '../lib/supabase-admin.js'

async function checkLotes() {
  try {
    console.log('🔍 Verificando registros na tabela lote_items...\n')

    // 1. Total de registros
    const { count: total } = await supabaseAdmin
      .from('lote_items')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Total de registros: ${total}`)

    // 2. Registros COM lote_id
    const { count: comLote } = await supabaseAdmin
      .from('lote_items')
      .select('*', { count: 'exact', head: true })
      .not('lote_id', 'is', null)
    
    console.log(`✅ Registros COM lote_id: ${comLote}`)

    // 3. Registros SEM lote_id
    const { count: semLote } = await supabaseAdmin
      .from('lote_items')
      .select('*', { count: 'exact', head: true })
      .is('lote_id', null)
    
    console.log(`❌ Registros SEM lote_id: ${semLote}`)

    // 4. Listar todos os clientes
    const { data: clientes } = await supabaseAdmin
      .from('lote_items')
      .select('cliente')
      .not('cliente', 'is', null)
    
    const clientesUnicos = [...new Set(clientes?.map(c => c.cliente) || [])]
    console.log(`\n👥 Clientes com registros (${clientesUnicos.length}):`)
    clientesUnicos.forEach(c => console.log(`   - ${c}`))

    // 5. Listar lotes únicos por cliente
    console.log(`\n📦 Lotes únicos por cliente:\n`)
    
    for (const cliente of clientesUnicos) {
      const { data: registros } = await supabaseAdmin
        .from('lote_items')
        .select('lote_id, produto, banco_simulado, created_at, status')
        .eq('cliente', cliente)
        .not('lote_id', 'is', null)
        .order('created_at', { ascending: false })
      
      const lotes = new Map()
      registros?.forEach(r => {
        if (r.lote_id && !lotes.has(r.lote_id)) {
          lotes.set(r.lote_id, {
            id: r.lote_id,
            produto: r.produto,
            banco: r.banco_simulado,
            created: r.created_at,
            status: r.status
          })
        }
      })

      console.log(`\n  Cliente: ${cliente}`)
      console.log(`  Total de lotes: ${lotes.size}`)
      
      if (lotes.size > 0) {
        console.log(`  Lotes:`)
        Array.from(lotes.values()).slice(0, 5).forEach((l, i) => {
          const dateStr = new Date(l.created).toLocaleString('pt-BR')
          console.log(`    ${i + 1}. ${String(l.id).slice(0, 20)}... | ${l.produto} | ${l.banco} | ${dateStr} | ${l.status || 'pendente'}`)
        })
        if (lotes.size > 5) {
          console.log(`    ... e mais ${lotes.size - 5} lotes`)
        }
      }

      // Verificar se há registros sem lote_id para este cliente
      const { count: semLoteCliente } = await supabaseAdmin
        .from('lote_items')
        .select('*', { count: 'exact', head: true })
        .eq('cliente', cliente)
        .is('lote_id', null)
      
      if (semLoteCliente > 0) {
        console.log(`  ⚠️ ${semLoteCliente} registros SEM lote_id`)
      }
    }

    console.log(`\n✅ Verificação concluída!`)
    
  } catch (error) {
    console.error('❌ Erro:', error)
  }
  
  process.exit(0)
}

checkLotes()

