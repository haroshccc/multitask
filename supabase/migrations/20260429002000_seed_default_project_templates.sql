-- Seeds three default project templates per organization. The templates power
-- the "תבניות פרויקט" block — clicking "טען" creates a new task list with the
-- pre-defined tasks under the current project, so users get a sensible starting
-- structure for common project types (UX flow / branding / agile dev).
DO $$
DECLARE
  org RECORD;
  default_owner uuid;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    SELECT user_id INTO default_owner
      FROM organization_members
     WHERE organization_id = org.id
     ORDER BY joined_at ASC
     LIMIT 1;
    IF default_owner IS NULL THEN CONTINUE; END IF;

    INSERT INTO project_templates (organization_id, owner_id, name, emoji, description, is_default, template_data)
    VALUES (org.id, default_owner, 'UX סטנדרטי', '🎨', 'תהליך UX מלא: מחקר → אפיון → עיצוב → מסירה.', true,
      jsonb_build_object('tasks', jsonb_build_array(
        jsonb_build_object('title', 'מחקר משתמשים וראיונות', 'estimated_hours', 8, 'urgency', 2),
        jsonb_build_object('title', 'מחקר מתחרים', 'estimated_hours', 4, 'urgency', 1),
        jsonb_build_object('title', 'אפיון מסכים', 'estimated_hours', 12, 'urgency', 3),
        jsonb_build_object('title', 'עיצוב UI', 'estimated_hours', 20, 'urgency', 3),
        jsonb_build_object('title', 'מסירה ופידבקים', 'estimated_hours', 4, 'urgency', 2)
      )))
    ON CONFLICT DO NOTHING;

    INSERT INTO project_templates (organization_id, owner_id, name, emoji, description, is_default, template_data)
    VALUES (org.id, default_owner, 'מיתוג בסיסי', '🎯', 'פלטה, לוגו וטיפוגרפיה לזהות מותג חדשה.', true,
      jsonb_build_object('tasks', jsonb_build_array(
        jsonb_build_object('title', 'מחקר מתחרים', 'estimated_hours', 4, 'urgency', 1),
        jsonb_build_object('title', 'מודבורד וכיווני עיצוב', 'estimated_hours', 6, 'urgency', 2),
        jsonb_build_object('title', 'עיצוב לוגו', 'estimated_hours', 10, 'urgency', 3),
        jsonb_build_object('title', 'פלטה וטיפוגרפיה', 'estimated_hours', 4, 'urgency', 2)
      )))
    ON CONFLICT DO NOTHING;

    INSERT INTO project_templates (organization_id, owner_id, name, emoji, description, is_default, template_data)
    VALUES (org.id, default_owner, 'פיתוח אג''יל', '⚡', 'מסלול פיתוח מלא.', true,
      jsonb_build_object('tasks', jsonb_build_array(
        jsonb_build_object('title', 'אפיון טכני', 'estimated_hours', 8, 'urgency', 3),
        jsonb_build_object('title', 'מבנה DB ו-schema', 'estimated_hours', 4, 'urgency', 3),
        jsonb_build_object('title', 'API endpoints', 'estimated_hours', 16, 'urgency', 3),
        jsonb_build_object('title', 'Frontend components', 'estimated_hours', 24, 'urgency', 3),
        jsonb_build_object('title', 'אינטגרציה ו-state', 'estimated_hours', 8, 'urgency', 2),
        jsonb_build_object('title', 'בדיקות', 'estimated_hours', 8, 'urgency', 2),
        jsonb_build_object('title', 'העלאה לייצור', 'estimated_hours', 4, 'urgency', 2),
        jsonb_build_object('title', 'תיעוד', 'estimated_hours', 4, 'urgency', 1)
      )))
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
