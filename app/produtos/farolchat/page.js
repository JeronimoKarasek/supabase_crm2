"use client"

import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function Feature({ title, desc }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </div>
  )
}

export default function FarolChatPresentation() {
  const images = [
    // Preferimos imagens públicas. Se alguma quebrar, Next/Image está unoptimized: true.
    'https://via.placeholder.com/1200x560?text=FarolChat+Vis%C3%A3o+Geral',
    'https://via.placeholder.com/1200x560?text=FarolChat+Inbox',
    'https://via.placeholder.com/1200x560?text=FarolChat+Relat%C3%B3rios',
  ]
  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6 space-y-6">
        <div>
    <div className="text-4xl font-bold text-foreground">FarolChat</div>
    <div className="text-muted-foreground">CRM de conversação de whatsapp</div>
        </div>

        {images.map((src, i) => (
          <div key={i} className="rounded-lg overflow-hidden border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`FarolChat ${i+1}`} className="w-full h-auto" />
          </div>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-black dark:text-white">Por que FarolChat?</CardTitle>
            <CardDescription className="text-black/70 dark:text-white/70">Plataforma moderna, aberta e escalável</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Feature title="Inbox Colaborativo" desc="Atenda múltiplos clientes simultaneamente, encaminhe conversas e gerencie filas com eficiência." />
            <Feature title="Automação" desc="Respostas rápidas, templates e integrações para acelerar seu atendimento." />
            <Feature title="Relatórios" desc="Acompanhe métricas de desempenho e qualidade com dashboards claros." />
            <Feature title="Escalabilidade" desc="De pequenas equipes a grandes operações, dimensione sem dor." />
            <Feature title="APIs" desc="Conecte o FarolChat ao seu ecossistema facilmente." />
            <Feature title="Multi‑canal" desc="WhatsApp como foco, com base preparada para outros canais." />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

