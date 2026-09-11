-- Reset de datos clínicos: deja únicamente las 16 evaluaciones v1.0
-- originales (id=5, 111-125) que se venían usando como línea base para
-- Kappa, y todo lo que cuelga de ellas. Borra el resto de evaluaciones
-- (v1.0 fuera de esas 16, todas las v2.0-threshold-only, todas las v2.1)
-- y el paciente que queda sin evaluaciones tras el borrado.
--
-- NO se tocan usuarios ni activity_logs.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_02d_reset_a_16_v1.sql

BEGIN;

CREATE TEMP TABLE evaluaciones_a_mantener AS
    SELECT id FROM evaluations WHERE id = 5 OR id BETWEEN 111 AND 125;

DELETE FROM recommendations
    WHERE evaluation_id NOT IN (SELECT id FROM evaluaciones_a_mantener);

DELETE FROM model_predictions
    WHERE evaluation_id NOT IN (SELECT id FROM evaluaciones_a_mantener);

DELETE FROM model_features
    WHERE evaluation_id NOT IN (SELECT id FROM evaluaciones_a_mantener);

DELETE FROM evaluations
    WHERE id NOT IN (SELECT id FROM evaluaciones_a_mantener);

-- Paciente(s) que quedaron sin evaluaciones
DELETE FROM patients
    WHERE id NOT IN (SELECT DISTINCT patient_id FROM evaluations);

COMMIT;
