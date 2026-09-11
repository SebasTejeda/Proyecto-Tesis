-- Migración: soporte de revalidación retrospectiva del modelo (v2)
-- Fecha: 2026-09-02
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_02_revalidacion_v2.sql
--
-- No modifica registros existentes salvo para poblar fecha_evaluacion_clinica
-- (se copia desde la columna "date" ya existente, nunca se inventa ni se deja en null).

BEGIN;

-- 1. Fecha real en que el especialista evaluó al paciente.
--    Para los registros existentes se puebla desde "date" (la fecha de la
--    consulta ya registrada al crear la evaluación).
ALTER TABLE evaluations
    ADD COLUMN fecha_evaluacion_clinica TIMESTAMP WITHOUT TIME ZONE;

UPDATE evaluations
    SET fecha_evaluacion_clinica = date
    WHERE fecha_evaluacion_clinica IS NULL;

ALTER TABLE evaluations
    ALTER COLUMN fecha_evaluacion_clinica SET NOT NULL;

-- 2. Fecha en que se ejecutó una revalidación técnica retrospectiva sobre el
--    caso. NULL para los registros originales (evaluados en tiempo real).
ALTER TABLE evaluations
    ADD COLUMN fecha_revalidacion_tecnica TIMESTAMP WITHOUT TIME ZONE;

-- 3. Trazabilidad: en un registro de revalidación, apunta al registro
--    original del que se copiaron las variables clínicas de entrada.
--    NULL en los registros originales.
ALTER TABLE evaluations
    ADD COLUMN original_evaluation_id INTEGER REFERENCES evaluations(id);

CREATE INDEX ix_evaluations_original_evaluation_id
    ON evaluations (original_evaluation_id);

-- model_version ya existe (character varying, default 'v1.0') — no se toca.

COMMIT;
