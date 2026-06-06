-- =============================================================================
-- Thought-developments — sharing enum value (separate tx).
--
-- A "thought development" (פיתוח מחשבה) is a NEW, independent entity — NOT a
-- row in `thoughts`. It collects a developed idea: source files (image / PDF /
-- PPT / docs / Excel / notebook / audio), a free-text summary + summary files,
-- an editable "written_at" date, an optional link to a single project OR a
-- single task-list, and user→user sharing.
--
-- Sharing reuses the generic `shares` table (entity_type / entity_id / user_id
-- / permission). Postgres forbids using a freshly-added enum value in the same
-- transaction that adds it, so the value is added here and consumed by the
-- companion migration 20260606000011_thought_developments.sql.
-- =============================================================================

alter type share_entity_type add value if not exists 'thought_development';
