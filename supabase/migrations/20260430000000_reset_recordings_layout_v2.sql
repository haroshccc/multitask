-- Recordings page widgets restructured: old layout had three short widgets
-- (filters / quick_record / drop_zone). New layout has five tall narrow
-- widgets (upload / quick_record / stats / player / filters_list). The
-- `quick_record` key collides between the two layouts, so saved positions
-- from the old layout would override the new tall default. Wipe saved
-- layouts for the recordings screen so every user lands on the new
-- defaults.
DELETE FROM user_dashboard_layouts WHERE screen_key = 'recordings';
