-- Los códigos de recuperación (recovery_code) y verificación (verification_code)
-- eran válidos indefinidamente, sin límite de tiempo — un código de 4 dígitos
-- sin expiración es vulnerable a fuerza bruta. Se agrega timestamp de
-- expiración para ambos (15 minutos desde su generación, ver auth.py/users.py).
--
-- Los usuarios existentes quedan con NULL: cualquier código ya emitido antes
-- de esta migración se tratará como expirado (NULL falla la validación
-- "expires_at IS NOT NULL AND now() < expires_at"), forzando a pedir uno nuevo.
--
-- Aplicar con:
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_17b_expiracion_codigos.sql

BEGIN;

ALTER TABLE usuarios
    ADD COLUMN recovery_code_expires_at TIMESTAMP NULL;

ALTER TABLE usuarios
    ADD COLUMN verification_code_expires_at TIMESTAMP NULL;

COMMIT;
