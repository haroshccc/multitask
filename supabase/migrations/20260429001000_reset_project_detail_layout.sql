-- One-time reset: saved layouts for project_detail used the old broken md
-- (tablet) defaults that cramped widgets at narrow desktop widths. Wipe them
-- so users pick up the new full-width single-column md defaults. Users can
-- re-arrange to taste; nothing else is lost.
DELETE FROM user_dashboard_layouts WHERE screen_key = 'project_detail';
