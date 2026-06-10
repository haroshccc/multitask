# תוכנית עבודה — תיקיות בדף ההקלטות

> מטרה: לחשוף בדף ההקלטות **סרגל תיקיות** קבוע — עץ מקונן של תיקיות מותאמות
> אישית (multi-membership), לצד "תיקיות חכמות" לפי שיוכים קיימים (פרויקט, יומן,
> רשימת משימות) ושיוך חדש לאיש קשר. שיוך הקלטה לתיקייה ע"י גרירה, תפריט-ימני,
> וכפתור בכרטיס.

## החלטות מוצר (אושרו)

| נושא | הוחלט |
|---|---|
| מודל שיוך | **תוויות** — הקלטה יכולה להיות בכמה תיקיות במקביל (many-to-many) |
| היררכיה | **עץ מקונן** — תיקיות בתוך תיקיות |
| שיוך | גרירה + תפריט-ימני/כפתור בכרטיס |
| מקורות תיקיות | תיקיות מותאמות **+ שיוכים קיימים** (פרויקט, רשימה/יומן) **+ איש קשר (חדש)** |

---

## 1. מה כבר קיים (לעשות בו שימוש חוזר — לא לבנות מחדש)

- **טבלה `recording_lists`** — שם, `emoji`, `color`, `sort_order`, ארכוב (60 יום).
  RLS owner-scoped. *זה כבר בעצם "תיקייה שטוחה".*
- **טבלה `recording_list_assignments`** — שיוך many-to-many
  (`recording_id`, `list_id`, `sort_order_in_list`). RLS org-scoped.
- **Service** `src/lib/services/recording-lists.ts` — list/create/update/archive +
  assign/unassign + `listAllAssignments`.
- **Hooks** `src/lib/hooks/useRecordingLists.ts` — `useRecordingLists`,
  `useCreateRecordingList`, `useUpdateRecordingList`, `useAssignRecordingToList`,
  `useUnassignRecordingFromList`, `useAllRecordingAssignments`.
- **קיבוץ/סינון** `RecordingsListBanner.tsx` — `ListGroupingState` כבר תומך
  `linkageType: "project" | "task_list" | "event_calendar" | "recording_list"`
  ו-`applyGrouping` כבר מסנן לפיהם (כולל "none"/"all").
- **UI שיוך** `RecordingLinkagePanel.tsx` → `RecordingListsPill` — multi-select
  + יצירה inline, בתוך נגן הפירוט.
- **Context** `widgets/context.tsx` — `RecordingsPageCtx` כבר חושף
  `listsByRecording: Map<recordingId, Set<listId>>`, `grouping`, `setGrouping`,
  `selectedId`.

> מסקנה: ~70% מהתשתית קיימת. הפער: (א) היררכיה ב-`recording_lists`,
> (ב) סרגל-צד ויזואלי עם עץ במקום dropdown, (ג) גרירה, (ד) צ'יפים בכרטיס,
> (ה) קישור חדש לאיש קשר.

## 2. מה חדש (net-new)

1. עמודת `parent_id` ב-`recording_lists` + בניית עץ + מניעת מעגלים.
2. רכיב **סרגל תיקיות** (עץ מתקפל) בדף ההקלטות.
3. **גרירה** (HTML5 DnD) של כרטיס הקלטה → צומת בעץ.
4. **תפריט-ימני / כפתור** בכרטיס → בחירת תיקייה.
5. **צ'יפים** של תיקיות על כרטיס ההקלטה.
6. **קישור הקלטה↔איש-קשר** (טבלה + UI) — להזין את "תיקיות לפי איש קשר".

---

## 3. מודל נתונים (מיגרציות)

### 3.1 היררכיה ב-`recording_lists`
```sql
alter table public.recording_lists
  add column parent_id uuid references public.recording_lists(id) on delete cascade;
create index recording_lists_parent_idx on public.recording_lists(parent_id);
```
- `on delete cascade` — מחיקת תיקיית-אם מוחקת צאצאים (להבהיר ב-UI; ברירת מחדל
  שלנו היא ארכוב, לא מחיקה — אז cascade רלוונטי רק למחיקה קשה).
- **מניעת מעגלים**: אכיפה ב-service (טיפוס: לפני קביעת `parent_id`, לוודא
  שה-parent אינו צאצא של הצומת). אופציונלי גם trigger ב-PG.
- `sort_order` הקיים = סדר אחים בתוך אותה רמה.

### 3.2 קישור הקלטה↔איש-קשר (חדש)
```sql
create table public.recording_contact_links (
  recording_id uuid references public.recordings(id) on delete cascade,
  contact_id   uuid references public.crm_contacts(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (recording_id, contact_id)
);
-- RLS: org-scoped דרך ה-recording, בדיוק כמו recording_list_assignments
```
- many-to-many (לפגישה אפשר כמה אנשי קשר). מקביל מלא ל-`recording_list_assignments`.
- **מיגרציה נפרדת** מקובץ ה-`parent_id` (טרנזקציות נפרדות, כמו במוסכמות הפרויקט).

> שתי המיגרציות יוחלו דרך Supabase MCP (`apply_migration`), ויירשמו בטבלת
> "Migrations applied" ב-`CLAUDE.md`.

---

## 4. שכבת Service + Hooks

### 4.1 `recording-lists.ts` (הרחבה)
- `createRecordingList` — לקבל `parent_id?` אופציונלי.
- `setRecordingListParent(listId, parentId)` — חדש; כולל בדיקת מעגל.
- `buildRecordingFolderTree(lists)` — pure helper (כמו `buildPlanTree`) →
  `FolderNode[]` עם `children`. למקם ב-`src/lib/recordings/folder-tree.ts`.

### 4.2 service חדש `recording-contacts.ts`
- `listContactLinksForRecording`, `listAllContactLinks`,
  `linkRecordingToContact`, `unlinkRecordingFromContact`.

### 4.3 Hooks
- `useRecordingLists` כבר מחזיר את כל השדות (כולל `parent_id` אחרי typegen).
- `useSetRecordingListParent()` — חדש (mutation; invalidate lists).
- `useRecordingContacts` / `useAllRecordingContactLinks` /
  `useLinkRecordingToContact` / `useUnlinkRecordingFromContact` — חדשים, מקבילים
  ל-hooks של הרשימות.
- **typegen**: להריץ `generate_typescript_types` אחרי המיגרציות; עד שמתעדכן —
  cast ל-`any` כמקובל.

---

## 5. UI

### 5.1 סרגל תיקיות — `RecordingsFolderTree.tsx` (חדש)
פאנל קבוע בצד הרשימה (במקום ה-grouping dropdown הנוכחי, או לצדו). מבנה:

```
📁 תיקיות שלי                    ← recording_lists מקוננות (drag target, ניתן ליצור/לקנן)
   └ 📁 לקוחות
        └ 📁 לקוח א'
🗂️ הכול
📂 לפי פרויקט                     ← virtual: צומת לכל project (linkageType=project)
📅 לפי יומן                       ← virtual: event_calendar
✅ לפי רשימת משימות               ← virtual: task_list
👤 לפי איש קשר                    ← virtual: contact (קישור חדש)
🚫 ללא תיקייה                     ← linkageId="none"
```

- לחיצה על צומת → מעדכנת `ctx.setGrouping({ mode:"linkage", linkageType, linkageId })`.
  כלומר **נשען על `applyGrouping` הקיים** — הסרגל הוא בעיקר UI חדש מעל לוגיקה קיימת.
- צמתים מתקפלים (chevron), בחירה פעילה מודגשת, ספירת הקלטות לצד כל צומת.
- "תיקיות שלי" בלבד ניתנות ליצירה/שינוי-שם/קינון/ארכוב; ה"חכמות" קריאה-בלבד.
- RTL: שימוש ב-`ps-`/`pe-`, הזחה לפי עומק עם `pe-{n}`.

### 5.2 גרירה (HTML5 DnD)
- מפתח `RECORDING_DND` (כמו `PLAN_ITEM_DND`).
- `RecordingCard` → `draggable`, מעביר `recording_id`.
- צומת בעץ = drop target:
  - תיקיית-משתמש → `assignRecordingToList(recordingId, listId)` (מוסיף; לא מסיר
    מאחרות, כי multi).
  - "לפי פרויקט/יומן/רשימת-משימות" → set FK בודד על ההקלטה.
  - "לפי איש קשר" → `linkRecordingToContact`.
- משוב ויזואלי: הדגשת היעד, opacity על הנגרר.

### 5.3 תפריט-ימני / כפתור בכרטיס
- `onContextMenu` על `RecordingCard` → תפריט: "הוסף לתיקייה ▸" (תת-תפריט עם העץ),
  "הסר מתיקייה ▸", "שייך לפרויקט/איש-קשר…".
- חלופה נגישה: כפתור "⋯" קטן בכרטיס שפותח אותו תפריט.
- שימוש חוזר בלוגיקת ה-assign של `RecordingListsPill`.

### 5.4 צ'יפים בכרטיס
- ב-`RecordingCard` להוסיף שורת צ'יפים של התיקיות שההקלטה משויכת אליהן
  (צבע+אימוג'י מ-`recording_lists`), נתון מתוך `ctx.listsByRecording`
  (כבר קיים, לא דורש שדות כבדים).
- אופציונלי: צ'יפ פרויקט/איש-קשר.

### 5.5 אינטגרציה בדף
- `Recordings.tsx`: להזין ל-context גם `contactLinksByRecording` (מקביל
  ל-`listsByRecording`) ואת עץ התיקיות. ה-`PlayerWidget` כבר מושך הקלטה מלאה —
  לא מושפע.

---

## 6. אזורים רגישים / מה לא נוגעים בו

- **לא נוגעים** בנתיב שמירת המשימות (TaskRow/TaskColumn/useTasks) — לא רלוונטי.
- **שאילתת `listRecordings` נשארת "קלה"** (שדרוג שכבר בוצע ב-`main`): הצ'יפים
  והעץ נשענים על `useAllRecordingAssignments` / קישורי-אנשי-קשר ועל
  `recording_lists` — **לא** על שדות כבדים. לא להחזיר `select("*")`.
- מחיקת תיקייה: להשתמש ב**ארכוב** הקיים (לא מחיקה קשה), כדי לא לאבד שיוכים.
  אם בכל זאת מוחקים — `on delete cascade` ינקה צאצאים ושיוכים.

## 7. שלבי מסירה (מומלץ — כל שלב נפרד לאישור)

- **שלב 1 — היררכיה + סרגל קריאה**: מיגרציית `parent_id`, `buildRecordingFolderTree`,
  `RecordingsFolderTree` המציג תיקיות-משתמש מקוננות + "חכמות" קיימות, לחיצה→סינון.
  *(ללא גרירה/יצירה — רק חשיפה ויזואלית של מה שקיים.)*
- **שלב 2 — ניהול תיקיות**: יצירה/שינוי-שם/קינון/ארכוב, צ'יפים בכרטיס.
- **שלב 3 — שיוך אינטראקטיבי**: גרירה + תפריט-ימני/כפתור.
- **שלב 4 — איש קשר**: מיגרציית `recording_contact_links`, service+hooks,
  צומת "לפי איש קשר" + שיוך.

## 8. בדיקות (לכל שלב: tsc + build + ידני)

- יצירת תיקייה מקוננת 3 רמות; ודא אין מעגל (לנסות לקנן תחת צאצא → חסום).
- שיוך הקלטה לכמה תיקיות; ודא שמופיעה בכולן ובצ'יפים.
- גרירה לתיקיית-משתמש / לפרויקט / לאיש-קשר.
- ארכוב תיקיית-אם → צאצאים מטופלים; שיוכים לא נעלמים מהקלטות.
- ביצועים: ודא שטעינת הדף נשארת קלה (אין משיכת תמלולים).

## 9. שאלות פתוחות / סיכונים

- **"רשימה"** בדרישה = `recording_lists` (התיקיות עצמן) או גם `task_lists`?
  בתוכנית הנחתי ש-`recording_lists` הן התיקיות, ו-`task_lists` נשאר כ"תיקייה חכמה"
  נפרדת. לאשר.
- **גרירה לצומת "חכם"** (פרויקט/יומן) מחליפה FK בודד קיים — להציג אישור?
- **קינון עמוק**: להגביל עומק (למשל 4) כדי לשמור על UI נקי?
- **שיתוף**: `recording_lists` הן owner-scoped (פרטי), בעוד השיוכים org-scoped.
  אם רוצים תיקיות משותפות לארגון — שינוי RLS נפרד (מחוץ לתוכנית הזו).
