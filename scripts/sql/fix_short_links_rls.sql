-- ==========================================
-- FIX: Permitir leitura pública de short_links
-- Para que o redirecionamento funcione sem autenticação
-- ==========================================

-- 1. Habilitar RLS na tabela
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- 2. Permitir LEITURA pública (qualquer pessoa pode ler para redirecionar)
CREATE POLICY "Permitir leitura pública de links"
ON short_links
FOR SELECT
USING (true);

-- 3. Permitir UPDATE público apenas do campo clicks (para incrementar contador)
CREATE POLICY "Permitir atualização de clicks"
ON short_links
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4. Apenas donos podem inserir/deletar
CREATE POLICY "Usuários podem criar próprios links"
ON short_links
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar próprios links"
ON short_links
FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- IMPORTANTE: Execute este SQL no Supabase
-- ==========================================
