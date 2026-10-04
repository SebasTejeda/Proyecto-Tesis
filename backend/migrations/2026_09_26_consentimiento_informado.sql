-- Consentimiento informado del paciente (Ley N.° 29733, Perú) — HU0021.
-- Antes de iniciar una evaluación clínica, el sistema debe registrar que el
-- paciente autorizó el tratamiento de sus datos de salud mental. Se pide una
-- sola vez por paciente, no en cada evaluación.
--
-- Los pacientes existentes quedan con consentimiento_informado = false, así
-- que a los especialistas se les pedirá el consentimiento retroactivamente
-- la próxima vez que abran una evaluación con esos pacientes.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_26_consentimiento_informado.sql

BEGIN;

ALTER TABLE patients
    ADD COLUMN consentimiento_informado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE patients
    ADD COLUMN consentimiento_fecha TIMESTAMP NULL;

COMMIT;
