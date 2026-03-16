-- ============================================================================
-- JdN FORGE — Schema inicial
-- Sem auth (uso interno), com Higgsfield + Google como providers primários
-- ============================================================================

-- Enum types
CREATE TYPE asset_status AS ENUM (
  'pending',
  'generating',
  'ready',
  'approved',
  'rejected',
  'failed'
);

CREATE TYPE asset_type AS ENUM (
  'image_to_video',    -- Gera imagem, depois vídeo
  'motion_graphic',    -- Hera/manual
  'static',            -- Screenshot, foto, logo
  'video_only'         -- Só vídeo direto
);

CREATE TYPE generation_tool AS ENUM (
  -- Higgsfield (primário)
  'higgsfield_nano_banana',
  'higgsfield_flux',
  'higgsfield_seedream',
  'higgsfield_kling',
  'higgsfield_dop',
  -- Google AI
  'google_nano_banana',
  'google_veo',
  -- Futuros (quando ativar chaves)
  'ideogram',
  'flux_fal',
  'runway',
  'kling_fal',
  -- Manuais
  'midjourney',
  'hera',
  'manual'
);

CREATE TYPE job_status AS ENUM (
  'queued',
  'running',
  'completed',
  'failed'
);

-- ============================================================================
-- Projects
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  style_bible_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Characters (referência visual de personagens)
-- ============================================================================
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',   -- URLs das fotos de referência
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Assets (cada ativo visual do plano de edição)
-- ============================================================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  asset_code TEXT NOT NULL,              -- ex: "A03", "H07", "S01"
  scene TEXT NOT NULL,                    -- ex: "Intro", "Cap 1", "Cap 5"
  description TEXT NOT NULL,
  asset_type asset_type NOT NULL,
  image_tool generation_tool,             -- Ferramenta pra gerar imagem
  video_tool generation_tool,             -- Ferramenta pra gerar vídeo
  prompt_image TEXT,                      -- Prompt pra geração de imagem
  prompt_video TEXT,                      -- Prompt pra geração de vídeo (movimento)
  parameters JSONB DEFAULT '{}',          -- seed, style_ref, duration, aspect_ratio etc
  status asset_status DEFAULT 'pending',
  image_url TEXT,                          -- URL da imagem gerada
  video_url TEXT,                          -- URL do vídeo gerado
  thumbnail_url TEXT,
  review_notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Generation jobs (cada chamada individual de API)
-- ============================================================================
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  provider generation_tool NOT NULL,
  job_type TEXT NOT NULL,                 -- 'image' ou 'video'
  external_task_id TEXT,                  -- ID retornado pela API (request_id, operation_name, etc)
  status_url TEXT,                        -- URL pra polling de status (Higgsfield)
  status job_status DEFAULT 'queued',
  request_payload JSONB,
  response_payload JSONB,
  result_url TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_assets_project ON assets(project_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_scene ON assets(project_id, scene);
CREATE INDEX idx_jobs_status ON generation_jobs(status);
CREATE INDEX idx_jobs_asset ON generation_jobs(asset_id);

-- ============================================================================
-- RLS — aberto (uso interno, sem auth)
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (acesso total pra todos)
CREATE POLICY "open_access" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_access" ON characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_access" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_access" ON generation_jobs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Função helper: atualizar updated_at automaticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Enable realtime pra tabela assets (cards atualizam sozinhos)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE assets;
