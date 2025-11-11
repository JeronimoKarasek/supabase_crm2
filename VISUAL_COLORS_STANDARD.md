# Padrão de Cores - FarolTech CRM

## Cores por Setor (Menu Lateral = Cabeçalho) ✅

| Setor | Cor Menu | Gradiente Header (from) | Gradiente Header (to) | Tailwind Classes |
|-------|----------|-------------------------|----------------------|------------------|
| **Dashboard** | `#3b82f6` (blue) | `blue-500` | `cyan-500` | from-blue-500 to-cyan-500 |
| **Clientes** | `#8b5cf6` (violet) | `violet-500` | `purple-500` | from-violet-500 to-purple-500 |
| **Senha de banco** | `#f59e0b` (amber) | `amber-500` | `orange-500` | from-amber-500 to-orange-500 |
| **Consulta em lote** | `#10b981` (emerald) | `emerald-500` | `green-500` | from-emerald-500 to-green-500 |
| **Simular/Digitar** | `#ec4899` (pink) | `pink-500` | `rose-500` | from-pink-500 to-rose-500 |
| **Disparo Whats API** | `#25D366` (WhatsApp) | `emerald-500` | `green-500` | from-emerald-500 to-green-500 |
| **Disparo SMS** | `#14b8a6` (teal) | `teal-500` | `cyan-500` | from-teal-500 to-cyan-500 |
| **Higienizar Dados** | `#a855f7` (purple) | `purple-500` | `fuchsia-500` | from-purple-500 to-fuchsia-500 |
| **NOVIDADES** | `#c97b1a` (custom orange) | `orange-500` | `amber-500` | from-orange-500 to-amber-500 |
| **Criação de produtos** | `#6366f1` (indigo) | `indigo-500` | `purple-500` | from-indigo-500 to-purple-500 |
| **Usuários** | `#06b6d4` (cyan) | `cyan-500` | `blue-500` | from-cyan-500 to-blue-500 |
| **Configuração** | `#64748b` (slate) | `slate-500` | `gray-500` | from-slate-500 to-gray-500 |

## Padrão de Cabeçalho

```jsx
{/* Header com gradiente */}
<div className="flex items-start gap-4">
  <div className="p-3 rounded-xl bg-gradient-to-br from-[COR1] to-[COR2] shadow-lg">
    <IconComponent className="h-8 w-8 text-white" />
  </div>
  <div>
    <h1 className="text-3xl font-bold bg-gradient-to-r from-[COR1-600] to-[COR2-600] bg-clip-text text-transparent">
      Nome do Setor
    </h1>
    <p className="text-muted-foreground mt-1">Descrição do setor</p>
  </div>
</div>
```

## Regra de Consistência
- **Ícone do menu** = Mesma cor base do gradiente do header
- **Gradiente do ícone** = from-[COR1] to-[COR2]
- **Gradiente do texto** = from-[COR1-600] to-[COR2-600] (tonalidade mais escura para contraste)
