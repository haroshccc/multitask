-- Israeli VAT changed to 18% on 2025-01-01. The old 17% default was a bug.
-- Update default and backfill rows still on the legacy 17% to the current rate.
ALTER TABLE public.projects
  ALTER COLUMN vat_percentage SET DEFAULT 18;

UPDATE public.projects
   SET vat_percentage = 18
 WHERE vat_percentage = 17;
