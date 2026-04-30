-- DashboardGrid now flips X coordinates between an "intent" frame (x=0 =
-- visual RIGHT, the natural reading start in Hebrew RTL) and a "visual"
-- frame (x=0 = visual LEFT, what react-grid-layout's positioning math
-- expects with direction:ltr).
--
-- Saved layouts from before this change are stored in the OLD frame
-- (which was "x=0 = visual left"). After the flip lands they would render
-- mirrored vs. what the user dragged. Wipe everything so every screen
-- lands on the freshly-flipped widget defaults — users can re-arrange.
DELETE FROM user_dashboard_layouts;
