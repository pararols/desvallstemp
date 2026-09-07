-- ========================================================
-- TAULA: festival_locations
-- Base de Dades Supabase per al Plànol Interactiu de Pluja d'Art
-- ========================================================

CREATE TABLE IF NOT EXISTS public.festival_locations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,          -- 'expo', 'show', 'serv'
    code TEXT NOT NULL,          -- '1', '2', '🎭', '🅿️1'...
    name TEXT NOT NULL,          -- Nom de l'espai (Ex: Can Batlle)
    artist TEXT,                 -- Nom de l'artista / col·lectiu
    project TEXT,                -- Títol del projecte / obra
    descripcio TEXT,             -- Descripció i detalls
    lat NUMERIC(10, 6) NOT NULL, -- Coordenada Latitud
    lng NUMERIC(10, 6) NOT NULL, -- Coordenada Longitud
    ordre INTEGER DEFAULT 0,     -- Ordre d'aparició a la llista
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Seguretat per Files (Row Level Security - RLS)
ALTER TABLE public.festival_locations ENABLE ROW LEVEL SECURITY;

-- Política 1: Permetre lectura pública a tothom (visitants de la web)
CREATE POLICY "Permetre lectura publica festival_locations"
    ON public.festival_locations
    FOR SELECT
    USING (true);

-- Política 2: Permetre inserció i actualització (administració del plànol)
CREATE POLICY "Permetre edicio festival_locations"
    ON public.festival_locations
    FOR ALL
    USING (true)
    WITH CHECK (true);
