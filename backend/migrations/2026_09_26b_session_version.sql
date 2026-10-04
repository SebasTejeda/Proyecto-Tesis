-- Sesión única por especialista: cuando un usuario inicia sesión en un
-- dispositivo/navegador nuevo, cualquier token emitido antes debe quedar
-- invalidado. Hoy el JWT no tiene estado en el servidor (solo expira por
-- tiempo), así que no hay forma de "cerrar" una sesión anterior.
--
-- session_version se incrementa en cada login (credenciales o Google) y en
-- logout; el claim "sv" del JWT se compara contra este valor en cada
-- request (ver dependencies.get_current_user). Si no coinciden, el token
-- quedó reemplazado por uno más nuevo.
--
-- Aplicar con (pgAdmin Query Tool, o psql si está en el PATH):
--   psql -U postgres -h localhost -d tesis_db -f backend/migrations/2026_09_26b_session_version.sql

BEGIN;

ALTER TABLE usuarios
    ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
