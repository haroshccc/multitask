-- Recordings page widgets restructured again per user request:
-- top row of three banners (quick_record / upload / stats) shrunk to h=3
-- and reordered so quick_record sits rightmost, upload in the middle, and
-- stats leftmost. The filters_list height drops from 12 → 11 to match.
-- Wipe saved positions so every user lands on the new defaults.
DELETE FROM user_dashboard_layouts WHERE screen_key = 'recordings';
