-- Relabeling: las 16 revalidaciones "v2.0" ya insertadas correspondían al
-- placeholder de solo-recalibración-de-umbral (mismo modelo que v1, sin
-- reentrenamiento real). Se conservan como registro histórico de esa
-- iteración intermedia, pero se retaguean para no confundirlas con el v2
-- real reentrenado (que se inserta con model_version="v2.1").
--
-- No se borra ninguna fila.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_02b_relabel_v2_threshold_only.sql

BEGIN;

UPDATE evaluations
    SET model_version = 'v2.0-threshold-only'
    WHERE model_version = 'v2.0';

COMMIT;
