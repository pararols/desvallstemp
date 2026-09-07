-- ========================================================
-- SCRIPT SQL IDEMPOTENT: SISTEMA DE VOLUNTARIS V2
-- Festival Pluja d'Art 2026 - Associació Desvalls Cultura
-- ========================================================

-- 1. TAULA D'ESPAIS
CREATE TABLE IF NOT EXISTS public.vol_espais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assegurar que existeix la columna 'ordre' si la taula ja existia
ALTER TABLE public.vol_espais ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 0;

-- 2. TAULA DE VOLUNTARIS
CREATE TABLE IF NOT EXISTS public.vol_voluntaris (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    cognom TEXT NOT NULL,
    telefon TEXT NOT NULL UNIQUE,
    dinar BOOLEAN DEFAULT true,
    dinar_persones INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vol_voluntaris ADD COLUMN IF NOT EXISTS dinar BOOLEAN DEFAULT true;
ALTER TABLE public.vol_voluntaris ADD COLUMN IF NOT EXISTS dinar_persones INTEGER DEFAULT 1;

-- 3. TAULA DE TORNS HORARIS (TRAMS AL MINUT + TASCA + LLOC)
CREATE TABLE IF NOT EXISTS public.vol_torns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dia TEXT NOT NULL,                  -- 'Divendres', 'Dissabte', 'Diumenge'
    espai_id UUID NOT NULL REFERENCES public.vol_espais(id) ON DELETE CASCADE,
    hora_inici TEXT NOT NULL,           -- '16:30'
    hora_fi TEXT NOT NULL,              -- '18:15'
    tasca TEXT NOT NULL DEFAULT '',      -- 'Venda de tiquets i suport a barra'
    lloc TEXT NOT NULL DEFAULT '',       -- 'Plaça de la Vila - Carpa Central'
    necessaris INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TAULA D'ASSIGNACIONS (VINCULADES AL TORN)
-- Si existia una taula antiga de vol_assignacions amb estructura anterior, l'adaptem
CREATE TABLE IF NOT EXISTS public.vol_assignacions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torn_id UUID REFERENCES public.vol_torns(id) ON DELETE CASCADE,
    voluntari_id UUID REFERENCES public.vol_voluntaris(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assegurar la columna torn_id si ja existia la taula
ALTER TABLE public.vol_assignacions ADD COLUMN IF NOT EXISTS torn_id UUID REFERENCES public.vol_torns(id) ON DELETE CASCADE;
ALTER TABLE public.vol_assignacions ADD COLUMN IF NOT EXISTS voluntari_id UUID REFERENCES public.vol_voluntaris(id) ON DELETE CASCADE;

-- Eliminar restriccions NOT NULL de les columnes antigues si existien
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vol_assignacions' AND column_name = 'dia') THEN
        ALTER TABLE public.vol_assignacions ALTER COLUMN dia DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vol_assignacions' AND column_name = 'hora') THEN
        ALTER TABLE public.vol_assignacions ALTER COLUMN hora DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vol_assignacions' AND column_name = 'espai_id') THEN
        ALTER TABLE public.vol_assignacions ALTER COLUMN espai_id DROP NOT NULL;
    END IF;
END $$;

-- Índexs de rendiment
CREATE INDEX IF NOT EXISTS idx_vol_torns_dia_espai ON public.vol_torns(dia, espai_id);
CREATE INDEX IF NOT EXISTS idx_vol_assignacions_torn ON public.vol_assignacions(torn_id);
CREATE INDEX IF NOT EXISTS idx_vol_assignacions_voluntari ON public.vol_assignacions(voluntari_id);

-- ========================================================
-- POLÍTIQUES DE SEGURETAT RLS (ROW LEVEL SECURITY)
-- Permetre lectura, creació, edició i eliminació per a l'App Web
-- ========================================================

-- Activar RLS
ALTER TABLE public.vol_espais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vol_voluntaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vol_torns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vol_assignacions ENABLE ROW LEVEL SECURITY;

-- 1. Eliminar polítiques antigues si existien per evitar errors de duplicitat
DROP POLICY IF EXISTS "Lectura pública vol_espais" ON public.vol_espais;
DROP POLICY IF EXISTS "Gestió completa vol_espais" ON public.vol_espais;
DROP POLICY IF EXISTS "Permetre tot vol_espais" ON public.vol_espais;
DROP POLICY IF EXISTS "Enable all access to vol_espais" ON public.vol_espais;
DROP POLICY IF EXISTS "Allow all for vol_espais" ON public.vol_espais;

DROP POLICY IF EXISTS "Lectura pública vol_voluntaris" ON public.vol_voluntaris;
DROP POLICY IF EXISTS "Registre i edició vol_voluntaris" ON public.vol_voluntaris;
DROP POLICY IF EXISTS "Permetre tot vol_voluntaris" ON public.vol_voluntaris;

DROP POLICY IF EXISTS "Lectura pública vol_torns" ON public.vol_torns;
DROP POLICY IF EXISTS "Gestió completa vol_torns" ON public.vol_torns;
DROP POLICY IF EXISTS "Permetre tot vol_torns" ON public.vol_torns;

DROP POLICY IF EXISTS "Lectura pública vol_assignacions" ON public.vol_assignacions;
DROP POLICY IF EXISTS "Inscripció i gestió vol_assignacions" ON public.vol_assignacions;
DROP POLICY IF EXISTS "Permetre tot vol_assignacions" ON public.vol_assignacions;

-- 2. Crear noves polítiques universals (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permetre tot vol_espais" ON public.vol_espais
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permetre tot vol_voluntaris" ON public.vol_voluntaris
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permetre tot vol_torns" ON public.vol_torns
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permetre tot vol_assignacions" ON public.vol_assignacions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ========================================================
-- 5. TAULA DE DIES DEL FESTIVAL (ORDRE I DADES DEL DIA)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.vol_dies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    data TEXT DEFAULT '',
    data_iso DATE,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assegurar columnes data_iso
ALTER TABLE public.vol_dies ADD COLUMN IF NOT EXISTS data_iso DATE;
ALTER TABLE public.vol_torns ADD COLUMN IF NOT EXISTS data_iso DATE;

-- Eliminar restriccions antigues de nom únic
ALTER TABLE public.vol_dies DROP CONSTRAINT IF EXISTS vol_dies_nom_key;

-- Índex únic per data_iso a vol_dies
CREATE UNIQUE INDEX IF NOT EXISTS idx_vol_dies_data_iso ON public.vol_dies(data_iso);
CREATE INDEX IF NOT EXISTS idx_vol_torns_data_iso ON public.vol_torns(data_iso);

ALTER TABLE public.vol_dies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública vol_dies" ON public.vol_dies;
DROP POLICY IF EXISTS "Gestió completa vol_dies" ON public.vol_dies;
DROP POLICY IF EXISTS "Permetre tot vol_dies" ON public.vol_dies;
CREATE POLICY "Permetre tot vol_dies" ON public.vol_dies FOR ALL USING (true) WITH CHECK (true);

