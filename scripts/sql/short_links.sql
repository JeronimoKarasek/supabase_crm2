-- Tabela para links curtos personalizados (farolbase.com/{slug})
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(20) UNIQUE NOT NULL,
  real_url TEXT NOT NULL,
  phone VARCHAR(20),
  message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_short_links_slug ON short_links(slug);
CREATE INDEX IF NOT EXISTS idx_short_links_user_id ON short_links(user_id);

-- RLS (Row Level Security)
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios links
CREATE POLICY "Users can view own short links" ON short_links
  FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários podem criar seus próprios links
CREATE POLICY "Users can create own short links" ON short_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Links públicos podem ser acessados para redirecionar (sem auth)
CREATE POLICY "Public can access short links for redirect" ON short_links
  FOR SELECT USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_short_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_short_links_updated_at ON short_links;
CREATE TRIGGER update_short_links_updated_at
  BEFORE UPDATE ON short_links
  FOR EACH ROW
  EXECUTE FUNCTION update_short_links_updated_at();

COMMENT ON TABLE short_links IS 'Links curtos personalizados para WhatsApp e SMS (ex: farolbase.com/abc123)';
