-- Second reset: lg breakpoint moved 1200→1400 and the grid no longer auto-
-- saves the defaults on first render. Any layout saved from previous visits
-- has positions baked under the old rules and would render cramped on narrow
-- desktops/phones-in-desktop-mode. Wipe them so the new defaults take.
DELETE FROM user_dashboard_layouts WHERE screen_key IN ('project_detail', 'home');
