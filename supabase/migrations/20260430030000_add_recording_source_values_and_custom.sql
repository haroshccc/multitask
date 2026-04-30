ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'recording';
ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'upload';

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS source_custom TEXT;
