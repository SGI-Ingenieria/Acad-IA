-- PostgREST conserva las firmas RPC en memoria. La notificación hace visible
-- la operación de retiro inmediatamente después de aplicar las migraciones.

notify pgrst, 'reload schema';
