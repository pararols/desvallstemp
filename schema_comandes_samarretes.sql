-- ========================================================
-- TAULA: comandes_samarretes
-- Base de Dades Supabase per a la comanda de samarretes de Desvalls Cultura
-- ========================================================

CREATE TABLE IF NOT EXISTS public.comandes_samarretes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_comanda TEXT UNIQUE NOT NULL,      -- Ex: 'SAM-2026-8492'
    nom TEXT NOT NULL,                     -- Nom i cognoms del comprador
    telefon TEXT NOT NULL,                 -- Telèfon de contacte
    email TEXT NOT NULL,                   -- Correu electrònic
    observacions TEXT,                     -- Observacions o comentaris
    items JSONB NOT NULL,                  -- Llistat de samarretes: [{"talla": "M", "color": "Blau", "unitats": 2}, ...]
    total_unitats INTEGER NOT NULL,        -- Nombre total de samarretes
    import_total NUMERIC(10, 2) NOT NULL,  -- Import en euros (€)
    estat TEXT DEFAULT 'pendent' NOT NULL, -- 'pendent', 'confirmat', 'lliurat', 'anul·lat'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Permisos explícits d'accés per a les claus públiques de Supabase (anon i authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.comandes_samarretes TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Habilitar Seguretat per Files (Row Level Security - RLS)
ALTER TABLE public.comandes_samarretes ENABLE ROW LEVEL SECURITY;

-- 3. Neteja de polítiques antigues si n'hi ha
DROP POLICY IF EXISTS "Permetre insercio publica comandes_samarretes" ON public.comandes_samarretes;
DROP POLICY IF EXISTS "Permetre lectura comandes_samarretes" ON public.comandes_samarretes;
DROP POLICY IF EXISTS "Permetre actualitzacio comandes_samarretes" ON public.comandes_samarretes;

-- 4. Polítiques RLS
CREATE POLICY "Permetre insercio publica comandes_samarretes"
    ON public.comandes_samarretes
    FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

CREATE POLICY "Permetre lectura comandes_samarretes"
    ON public.comandes_samarretes
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

CREATE POLICY "Permetre actualitzacio comandes_samarretes"
    ON public.comandes_samarretes
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5. Forçar recàrrega de la memòria cau de l'API de Supabase
NOTIFY pgrst, 'reload schema';
