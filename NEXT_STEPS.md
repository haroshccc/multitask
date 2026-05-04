# המשך עבודה — מה לא הספקנו

עודכן אחרון: 2026-05-03 (אחרי 17 גלים על AI brief, tasks, calendar, gantt)

## פרומט להפעלה בסשן הבא

> בסשן הקודם השלמנו 17 גלים — ראי `SPEC.md` בסוף הקובץ לסיכום מלא. הקוד כולו ב-main, פרוס ל-Vercel + Supabase v7 של edge function. עכשיו אני רוצה להמשיך מה שלא הספקנו. לפני שאת מתחילה, קראי את `NEXT_STEPS.md` (הקובץ הזה) ושאלי אותי במה להתחיל.

## משימות פתוחות (לפי עדיפות)

### דחוף — UX gaps שנותרו ממה שעבדנו עליו

1. **Drag-to-nest ב-GanttTable** (גל 14.C נדחה). המשתמשת ביקשה במפורש "גרירה למעלה למטה כולל בתוך או מחוץ למשימה אחרת — כמו במסך המשימות". כעת יש רק ↑/↓ buttons לreorder ו-modal לnest. צריך:
   - Refactor `<tr>` → `<div role="row">` עם CSS grid (table layout לא תומך ב-3 absolute strips).
   - 3-zone droppable per row (above/nest/below) זהה ל-TaskRow.
   - DndContext חיצוני ב-`Gantt.tsx`.
   - `handleDragEnd` עם 3 cases — שכפול מ-`Tasks.tsx` עם adjustments ל-GanttRow.
   - **אומדן: ~3 שעות**.

2. **Custom fields ב-Gantt column manager** (גל 10 לא הוסיף). יש כבר תשתית של `task_custom_fields` ב-DB ו-`TasksBlock` של Projects משתמש בה. צריך:
   - הרחבת `useGanttColumnPrefs` לתמוך ב-custom field IDs.
   - "+ custom field" button ב-popover שפותח list של fields של הproject (אם source.kind === "project").
   - Cell renderer שמתאים ל-`field_type` (date / select / stars / text / number / checkbox / person / etc).
   - **אומדן: ~4 שעות**.

3. **Schedule מ-timeline ב-Gantt** (חסר ש-bug review מצא). משימה לא מתוזמנת לא ניתן לתזמן ע"י לחיצה על ה-timeline בשורה שלה (כי אין bar). צריך:
   - אם click ב-timeline body על שורה של unscheduled task → set scheduled_at לזמן הקליק.
   - או: drop של משימה לא מתוזמנת מ-table ל-timeline → אותה אופרציה.
   - **אומדן: ~1 שעה**.

### חשוב — לא נגענו ב-session

4. **בדיקת Daily Brief AI עם v7**. ה-prompt חזק יותר עכשיו (חוקים קשיחים + deadline awareness). המשתמשת לא בדקה את ה-brief מאז. צריך ללחוץ "רענן" על ה-day view ולוודא שיש proposals שמכבדים את ה-deadline.

5. **מסך פרויקטים** — לא נגענו בו. יש `TasksBlock` עשיר עם custom fields שכן ראינו, אבל המסך עצמו לא נסקר.

6. **מסך הקלטות / מחשבות / זמן עבודה** — לא נגענו.

### Polish + טכני

7. **Bundle size** — ה-build מתריע על chunks > 500KB. השלב הבא: code-splitting דרך `React.lazy` per page (Tasks / Gantt / Calendar / Projects). יש שיפור משמעותי לטעינה הראשונה.

8. **Drag-to-nest מ-table של Tasks → אחר** — כמו #1 אבל לטסקים, אם תהיה בעיה.

9. **המעבר project → list עם N רשימות** — נכון לעכשיו יוצר רשימה אחת חדשה ומאחד הכל. השאלה: מה קורה אם המשתמשת רוצה לשמר רשימה ספציפית (לא ליצור חדשה)? אופציה ל-picker עתידי.

## באגים ידועים שלא תוקנו

- **Selection state drift** (Tasks.tsx + selection store) — כש tasks משתנים מהר (drag/create/delete), יש חלון קצר ש-orderedIds מפגר אחרי selected. תיאורטי, לא ראיתי תקלה אמיתית.
- **CalendarDayView cast** — ה-cast `(item.source as { id: string }).id` בלי `kind !== "deadline"` assertion. מוגן ע"י early return בעת deadline. tight coupling, לא בעיה אקטיבית.
- **Deadline + scheduled overlap** ב-Calendar — אם משימה יש לה גם scheduled_at וגם deadline_at קרובים מאוד (e.g. 5 דקות הפרש), הם יחפפו ויזואלית.

## נקודות שצריכות בדיקת UI מהמשתמשת

- ה-deadline save fix (Wave 13) — נדרש לוודא שה-deadline נשמר אחרי refresh. (המשתמשת דיווחה שלא נשמר; ה-fix נפרס אחרי הבדיקה).
- Bulk toolbar ב-Gantt — וריפיקציה שעובד מסך הגאנט (פרס בWave 14.A+B).
- Parent completion bubble — וריפיקציה ש-parent מסומן כשכל הילדים סומנו (Wave 11).
- Reorder arrows ב-Gantt rows (Wave 14.C).

## הקשר טכני חשוב

- **Gantt source persisted ב-localStorage** — `multitask.gantt.source` כ-JSON. אם schema משתנה, צריך migration code.
- **Selection store** ב-Zustand, scoped to single screen (cleared on unmount).
- **pushUndo pattern** — כל mutation גוללת snapshot של prev state. ה-undo צריך להיות symmetric (לא להפעיל ה-bubble של completion שוב, כי ה-snapshot כבר תופס את ה-state הסופי).
- **ה-Vercel deploy לפעמים נכשל על TypeScript noUnusedLocals** — `tsc -b` באמת מחמיר יותר מ-`tsc --noEmit`. תמיד להריץ `npm run build` לפני push.

## תזכורת לפני שמתחילים

- **Branch:** `claude/continue-app-build-Sfzpk` (תמיד dev שם, אז merge ל-main).
- **DB:** Supabase project `rzlvuaqbvfzkunbyyvbc` (multitask).
- **Edge function:** `daily-brief` v7 (חוקים קשיחים + deadline).
- **Migration אחרון:** `20260503000000_task_deadline_at.sql`.
