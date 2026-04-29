-- Adds a new screen key for the per-project block-grid layout.
-- scope_id on dashboard_layouts will hold the project UUID, giving each project
-- its own persisted block arrangement that survives across sessions/devices.
ALTER TYPE dashboard_screen ADD VALUE IF NOT EXISTS 'project_detail';
