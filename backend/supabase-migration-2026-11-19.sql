-- ============================================================
-- Migración 2026-11-19 — Transferencias entre cuentas
-- Ejecutar en Supabase → SQL Editor (es seguro repetirla).
--
-- Un movimiento de tipo TRANSFER saca plata de `card_id` (origen)
-- y la pone en `to_card_id` (destino). No cuenta como ingreso ni gasto.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS to_card_id UUID REFERENCES cards(id) ON DELETE SET NULL;

-- Reemplazar el CHECK del tipo para permitir 'TRANSFER'
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('INCOME', 'FIXED', 'VARIABLE', 'SAVINGS', 'TRANSFER'));
