-- =============================================================================
-- Add 'contact' to custom_field_entity — the CRM contacts feature
-- (20260605000011_crm_contacts) creates per-contact custom fields with
-- entity_type='contact', but the enum (from 20260605000005) only had
-- task/meeting/payment. Without this value those inserts fail at runtime.
-- =============================================================================

alter type public.custom_field_entity add value if not exists 'contact';
