-- Distingue pacientes clínicos reales de pacientes sintéticos de prueba
-- (e2e_tests/run_15_random.py), tras confirmarse que 15 de los "16 casos
-- reales" usados para Kappa eran en realidad datos sintéticos generados
-- por ese script (evidencia: DNI en su rango de generación 60000000-69999999,
-- coincidencia exacta fila por fila con e2e_tests/test_results.csv).
--
-- No se asume que el resto de los pacientes preexistentes sea real: quedan
-- en "pendiente_verificacion" hasta confirmación manual. Nada se borra.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_02c_origen_paciente.sql

BEGIN;

ALTER TABLE patients
    ADD COLUMN origen VARCHAR NOT NULL DEFAULT 'clinico_real';

-- Los pacientes que ya existían antes de esta migración no tienen origen
-- confirmado — no se asume que sean reales solo porque no vinieron del
-- script de prueba conocido.
UPDATE patients SET origen = 'pendiente_verificacion';

-- Confirmados sintéticos: DNIs tomados directamente de e2e_tests/test_results.csv
-- (paciente_test_id 108-122, generados por run_15_random.py el 2026-08-29).
UPDATE patients SET origen = 'sintetico_prueba'
WHERE dni IN (
    '65869332','65324163','61253374','67007771','67866363',
    '62687555','63059884','63387002','64352037','63296230',
    '67601138','61765855','65091439','68224134','69680144'
);

COMMIT;
