-- Permite registrar pacientes con DNI o Carnet de Extranjería (CE), en vez
-- de asumir siempre DNI. Se agrega "tipo_documento" y se renombra la columna
-- "dni" a "numero_documento" (mismo dato, mismas restricciones unique/not
-- null/index — el RENAME preserva el constraint e índice existentes).
--
-- Todas las filas existentes son DNI (único tipo soportado hasta ahora),
-- por eso el default 'DNI' es seguro para los registros preexistentes.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_17_tipo_documento_numero_documento.sql

BEGIN;

ALTER TABLE patients
    ADD COLUMN tipo_documento VARCHAR NOT NULL DEFAULT 'DNI';

ALTER TABLE patients
    RENAME COLUMN dni TO numero_documento;

COMMIT;
