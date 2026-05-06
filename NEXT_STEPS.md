# המשך עבודה — מה לא הספקנו

עודכן אחרון: 2026-05-06 (סשן Food photos + interactive menu + Goals/Habits feature)

---

## TL;DR — מה ענינו על "מה הלאה" (תקציר מהצ'אט)

### מה השלים בסשן הזה
- **Food**: תמונות למנות (סכמה + bucket עם RLS + UI ב-MealEditModal + thumbnails) + מסך תפריט אינטראקטיבי "Wolt-like" עם בחירת תאריכים/ימים/שבועות, סקציות לפי ארוחה, כרטיסי תמונה, "שכפלי משבוע שעבר".
- **Goals/Habits**: 5 עמודות חדשות ב-tasks · `computeGoalStats` (סטריק / X-of-Y / זמן / beats בלי זמן) · מסך `/app/goals` · 🎯 chip ב-TaskRow · 2 ווידג'טים בדשבורד (ההרגלים שלי + פעימות בלי זמן עם quick-fill ו"לא רלוונטי").

### מה נשאר לפי ה-MD (תמצית)

**A · AI placeholders שמחכים לחיווט** ← הכי דחוף, זה הבא בתור:
1. "הצע תמונה" ב-MealEditModal — צריך להחליט בין DALL-E / Unsplash / משהו אחר, ואיפה ה-API key יושב.
2. "הצע תפריט" ב-InteractiveMenuTab — preview ניתן לעריכה לפני שמירה.
3. (אופציונלי) הצעת קטגוריה+מצרכים אוטומטית לפי שם מנה.

**B · Goals polish:**
- מספר סטריק על ה-🎯 chip ב-TaskRow (החישוב כבר קיים).
- Filter "רק יעדים" ב-FilterBar.
- ספארקליין בכרטיסיית יעד.
- Toast + confetti לאבן דרך.
- "Freeze days" כמו ב-Duolingo.

**C · נושאים ישנים שעדיין פתוחים** (drag-to-nest ב-Gantt, custom fields ב-Gantt, מסך פרויקטים deep-dive, וכו').

**D · פאזות שלמות שלא נגענו בהן** (חדש בסיכום הזה — ראי "פאזות לא נגיעות" למטה):
- פאזה 6ג שלב 2 — Claude Haiku לסיכום הקלטות + חילוץ משימות.
- פאזה 9b — Google Calendar sync דו-כיווני (placeholder בלבד היום).
- פאזה 10 — WhatsApp inbound/outbound.
- פאזה 11 — Notifications (יש סכמה, אין impl אמיתי מעבר ל-stub).
- §6 — Billing / Stripe (יש hooks בסכמה, אין UI/אינטגרציה).
- §17 (#17 בסדר הבנייה) — Landing אינטראקטיבי.
- §20 — תמחור פרויקטים (חישובי VAT, hourly_rate, expenses) — לא ברור אם הוטמע.

### הפרומט לסשן הבא — AI חיווט
> בסשן הקודם השלמנו שני מסלולים גדולים: (1) תמונות למנות + מסך תפריט אינטראקטיבי (Wolt-like) ב-Food, ו-(2) פיצ'ר יעדים/הרגלים מלא (סכמה + מסך `/app/goals` + ווידג'טים בדשבורד + חישובי סטריק/X-of-Y/זמן/missing-beats). הכל ב-main, פרוס. קראי את `NEXT_STEPS.md` (סשן 2026-05-06 בראש), ספציפית את **חלק A — AI placeholders שמחכים לחיווט**. אני רוצה לעבור לחיווט ה-AI: שני כפתורי "בקרוב" ב-Food (`הצע תמונה` ב-MealEditModal ו-`הצע תפריט` ב-InteractiveMenuTab) צריכים להיהפך לפיצ'רים אמיתיים. תתחילי בלשאול אותי איזה ספק AI אני מעדיפה לכל אחד (Anthropic Claude לטקסט / OpenAI gpt-image-1 או Unsplash לתמונות / הצעה אחרת), ואיפה לאחסן את ה-API keys (Edge Function secret? Supabase Vault?). אל תתחילי לקודד עד שאישרתי את ה-stack. אחרי שאישרתי, בואי נעבוד שלב-שלב: (1) הצע תמונה ב-MealEditModal עם flow שלם של preview + "החלף", (2) הצע תפריט שמייצר preview ניתן לעריכה לפני שמירה, (3) חיווט "הצעה לפי שם המנה" אם נשאר זמן.

---

## פאזות שלא נגענו בהן (אינדקס מהיר מ-`SPEC.md`)

הסעיפים האלה מוגדרים ב-SPEC אבל לא הוטמעו, או הוטמעו רק כ-placeholder. סדר הצגה לפי "סדר הבנייה" (§3 ב-SPEC) + סעיפי אינטגרציות חיצוניות.

| # | פאזה / סעיף | סטטוס | מה חסר בפועל |
|---|---|---|---|
| 1 | **6ג שלב 2** — Claude Haiku להקלטות (§18) | 🟡 חצי | תמלול Gladia מחובר; חסר: סיכום + חילוץ משימות אוטומטי מ-transcript. הכפתור "עיבוד AI" מסתיים אחרי השלב הראשון בלבד. |
| 2 | **9b** — סנכרון Google Calendar (§9) | ⬜ placeholder | יש כפתור "🎥 צור Meet" disabled; חסר: OAuth scope, חיווט ה-Edge Function שדוחף `events` ל-Google ומקשיב ל-webhooks. |
| 3 | **10** — WhatsApp (§10) | ⬜ לא קיים | inbound (קליטת הודעה → מחשבה / משימה) + outbound (שליחת תזכורות) דרך מספר עסקי. כל הסכמה ב-SPEC, אין קוד. |
| 4 | **11** — Notifications (§11) | 🟡 stub בלבד | יש `NotificationsStub` בדשבורד ושדה `notifications` ב-DB; חסר: ערוץ push (web push / email / WhatsApp), נדודי אופ-אין, ניהול העדפות. |
| 5 | **§6** — Billing hooks / Stripe | ⬜ נדחה במכוון | שדות `plan`, `subscription_status` קיימים בסכמה. אין UI, אין Stripe webhook, אין paywall. |
| 6 | **§17 (#17)** — Landing אינטראקטיבי | ⬜ Landing סטטי בלבד | קיים `Landing.tsx` עם content סטטי. ה-SPEC מדבר על demo אינטראקטיבי שמראה את התשתית. |
| 7 | **§20** — תמחור פרויקטים | ⬜ סכמה בלבד | נוסחאות (`hourly_rate`, `vat_percentage`, `spare_mode`, `expenses`) מתועדות ב-SPEC. ה-`Projects.tsx` הקיים עוסק בעיקר במשימות, לא בתמחור. |
| 8 | **§7** — Super Admin (UI מורחב) | 🟡 חלקי | יש `Admin.tsx` ו-flag `is_super_admin`. ה-SPEC מתאר עוד יכולות (cross-org views, impersonation, אנליטיקה). לא ברור עד כמה הוטמעו. |
| 9 | **Food / Goals** (לא ב-SPEC) | ✅ הסתיים בסשן הזה | (לא חלק מה-SPEC המקורי. נוספו בסשנים האחרונים.) |

> **הערה:** תאריך עדכון ה-SPEC הוא 2026-04-27 והוא מקפיא את הסטטוס באותו רגע. משם ועד היום (2026-05-06) הוסיפו את פאזה 8 (Brief AI), 17 גלים על Tasks/Calendar/Gantt, ועכשיו את Food + Goals — שלושת הקטעים האלה לא חוזרים ל-SPEC עצמו, רק ל-Changelog שלו.

---

## סשן 2026-05-06 — מה השלמנו

### מסלול 1 · תמונות למנות + תפריט אינטראקטיבי (Wolt-like)

**Schema:**
- `meals.image_url` — TEXT nullable. כל מנה יכולה לשאת תמונה.
- Storage bucket `meal-images` (פומבי לקריאה, 5MB max, JPG/PNG/WEBP/GIF) עם RLS שמתיר כתיבה רק לחברי הארגון לפי prefix של ה-path: `<organization_id>/<uuid>.<ext>`.

**Service** (`src/lib/services/food.ts`):
- `uploadMealImage(orgId, file) → public URL`
- `deleteMealImage(publicUrl)` — best-effort cleanup לפי path מתוך ה-URL.

**UI:**
- `MealEditModal` — סקציית "תמונה" עם 3 אפשרויות:
  - "העלי תמונה" → קובץ → bucket → URL.
  - "הדביקי קישור" → window.prompt לכתובת חיצונית.
  - "הצע תמונה (בקרוב)" — disabled placeholder ל-AI.
- `MealsTab` — thumbnail 40×40 ליד שם המנה.
- מסך חדש `InteractiveMenuTab` ("תפריט אישי") בלשונית הראשונה ב-Food:
  - 4 מצבי תאריך: מחר / ספציפי / טווח / כל השבוע.
  - טוגל "לכל יום בנפרד" / "אותו תפריט לכל הימים" (במצב same-for-all עובד עם דייט סינתטי `*` ומפוזר ל-replaceMealPlanDayCell בכל יום ביעד בעת השמירה).
  - טאבים לכל יום בטווח (only when per-day && multi-day).
  - 5 סקציות לפי meal-time עם כרטיסי גלילה אופקית במובייל / רשת בדסקטופ.
  - כרטיס: תמונה 4:3, שם, 4 מקרו (קל'/חלבון/שומן/פחמ'), ✓ overlay על נבחרים.
  - "שכפלי משבוע שעבר" — מטעין `meal_plan_days` של (from-7d, to-7d) עבור המשתמש הנוכחי וממפה לפי offset.
  - "הצע תפריט (בקרוב)" — disabled placeholder ל-AI.
  - Sticky save bar: פאן-אאוט ל-`replaceMealPlanDayCell` לכל (date, mealTime); משבצות ריקות מנקות שורות קיימות.

**Commits:** `883bc00` (תמונות) · `1069677` (תפריט אינטראקטיבי).

---

### מסלול 2 · יעדים / הרגלים

**Schema** (5 עמודות חדשות ב-`tasks`):
- `goal_period` TEXT CHECK IN (`day`, `week`, `month`) — NULL ⇒ לא יעד.
- `goal_target` INTEGER ≥1 — כמה פעמים בתקופה.
- `goal_min_streak_periods` INTEGER ≥1 — כמה תקופות ברצף ל"אבן דרך"; NULL ⇒ לתמיד.
- `goal_started_on` DATE — להציג "התחלת לפני N ימים".
- `goal_track_time` BOOLEAN NOT NULL DEFAULT TRUE — שולט בנודג' "פעימות בלי זמן" בדשבורד.
- אינדקס חלקי `(organization_id, goal_period) WHERE goal_period IS NOT NULL` — מסך היעדים סורק רק את התת-קבוצה.

**Computation** (`src/lib/goals/computation.ts`, פונקציות טהורות, ראשון-מעוגן ישראלי):
- `startOfDay/Week/Month/Period`, `addPeriods`, `periodDiffCount`.
- `computeGoalStats(task, timeEntries, now?)` מחזיר:
  - `currentStreak` — תקופות רצופות שעמדו ביעד (כולל הנוכחית רק אם כבר עמדה).
  - `bestStreak` — מאז `goal_started_on` (או lifetime).
  - `currentPeriodCount/Target/Hit` — כמה השלמות בתקופה הנוכחית.
  - `lookbackHits / lookbackTotal` — חלון "X מתוך Y" (`min_streak_periods` או דיפולט 7/4/3 לפי תקופה).
  - `totalPeriodsHit / totalPeriodsCounted` — שיעור הצלחה לכל החיים.
  - `thisPeriodMinutesActual / Planned` — סכום `time_entries` בתקופה מול `target × duration_minutes`.
  - `beatsWithoutTime` — תאריכי השלמות שאין להן `time_entry` באותו יום (ל"פעימות בלי זמן").
  - `reachedMilestone` — האם `bestStreak ≥ min_streak`. NULL במצב "לתמיד".
- Hebrew helpers: `periodLabelHe`, `periodUnitHe`.

**UI:**
- `TaskEditModal` (טאב "תזמון", אחרי "חזרה"): סקציית "🎯 יעד / הרגל".
  - טוגל "הגדר כיעד".
  - צ'יפים יומי / שבועי / חודשי.
  - "לבצע N פעמים בשבוע/בחודש/ביום".
  - צ'קבוקס "ללא סיום (ההרגל ימשיך לעד)" — ברירת מחדל מסומן. כיבוי חושף "אבן דרך ראשונה: M תקופות ברצף".
  - תאריך התחלת מעקב (ריק = היום אוטומטית בעת השמירה).
  - "עקבי גם אחרי זמן בפועל" — שולט בנודג'.
  - דירטי-צ'ק + undo/redo prevPatch/newPatch + create-mode payload כולם מסונכרנים.
- `TaskRow`: 🎯 chip צבעוני (primary) ליד אינדיקטור החזרתיות; tooltip "יעד: 3 פעמים בשבוע".
- מסך **`/app/goals`**: `ScreenScaffold(narrow)`, `GoalCard` לכל יעד:
  - Header: 🎯 שם · "3 פעמים בשבוע · אבן דרך: 4 שבועות ברצף · התחלת לפני 23 ימים".
  - בר התקדמות לתקופה הנוכחית עם N/T + ✓.
  - 3-4 אריחי סטטיסטיקה: 🔥 סטריק · 🏆 שיא · 📈 X/Y חלון סלחני · ⏱ זמן (כשרלוונטי).
  - Footer chips: hit-rate לכל החיים · 🎉 אבן דרך הושגה · "N פעימות בלי זמן" (אמבר).
  - "ערכי" → פותח `TaskEditModal` בטאב תזמון.
- ניווט: `AppShell` קיבל פריט חדש "יעדים" עם Target icon, בין "משימות" ל"יומן".
- ראוטינג: `/app/goals` lazy chunk ב-`App.tsx`.

**Dashboard widgets** (כברירת מחדל בתחתית כדי לא לשבור layouts שמורים של משתמשים קיימים):
- **GoalsSummary** — "ההרגלים שלי": רשימת שורות קומפקטית, לכל יעד בר התקדמות + סטריק, לחיצה → /goals.
- **MissingBeatTime** — "פעימות בלי זמן": שורה לכל פעימה ללא זמן באותו יום (רק ביעדים עם `goal_track_time=true` ו-`duration_minutes` מוגדר). שדה דקות מאוכלס מראש מ-`duration_minutes` + ✓ (יוצר `time_entry` ידני ב-12:00 ביום הפעימה) + "לא רלוונטי" (מבטל `goal_track_time` למשימה לתמיד). אחרי פעולה השורה קורסת לאישור.
- Plumbing: `useCreateManualTimeEntry` עכשיו מבטל גם את משפחת ה-queries `["time-entries-range"]` כדי שהווידג'ט יתרענן מיד.

**Commits:** `3d8f861` (סכמה + עורך משימה) · `c520487` (מסך יעדים + חישובים) · `5ca7d8c` (ווידג'טים בדשבורד).

---

## מה עוד נשאר מהסשן הזה

### A. AI placeholders שמחכים לחיווט

1. **"הצע תמונה" ב-`MealEditModal`** — כפתור disabled עם tooltip "בקרוב".
   - אופציה 1: DALL-E / gpt-image-1 (Anthropic לא מייצר תמונות; OpenAI כן).
   - אופציה 2: Unsplash API לחיפוש תמונה לפי שם המנה.
   - אופציה 3: serverless route ב-Supabase Edge Function שמתווך ומטמין.
   - דרוש: API key, edge function `suggest-meal-image`, החלפת ה-disabled state ב-loading + הזנת ה-URL ל-state, יכולת "החלף תמונה" אם המשתמשת לא אהבה.

2. **"הצע תפריט" ב-`InteractiveMenuTab`** — placeholder גדול יותר.
   - דרוש מודל שמכיר את:
     - רשימת המנות הקיימות של הארגון (`useMeals`).
     - העדפות המשתמשת (אילו מנות נבחרו לאחרונה — `meal_plan_days` lookback, אילו תוייגו עם "אהבתי").
     - סוגי הארוחות והרגלי תזונה (אם נוסיף שדות כאלה ל-meals).
   - Edge function `suggest-menu` שמקבל {dateRange, perDay/sameForAll, mealsPool} → JSON של בחירות → ה-frontend מאוכלס את ה-selection state.
   - שיקול UX: להציג "הצעה" בתור preview שאפשר לערוך לפני שמירה (לא לשמור אוטומטית).

3. **"הצעה לפי שם המנה" ב-AI** (אופציונלי) — חיווט gpt-text כדי שכשמזינים שם של מנה, להציע אוטומטית קטגוריה + meal_times + מצרכים נפוצים. לא דובר אבל זה משלים יפה את "הצע תמונה".

### B. Goals — שיפורים ל-polish

4. **Streak number על ה-🎯 chip ב-`TaskRow`** — כרגע רק אייקון. החישוב כבר זמין דרך `computeGoalStats`. דורש `useTimeEntriesByRange` בתוך TaskRow (אולי מסונכרן ברמת ה-row context כדי לא לבצע N queries).

5. **"רק יעדים" filter chip ב-FilterBar** — הסכמה כבר תומכת (`goal_period IS NOT NULL`). מצריך הוספה ל-`FilterConfig` + UI chip + URL state.

6. **גרף זמן בכרטיסיית יעד** — ספארקליין של 7/4/3 התקופות האחרונות (השלמות לתקופה). חזותית מפסיק את הצורך ב-X/Y עם 4 מספרים ובמקומו ספארקליין.

7. **חגיגת "אבן דרך הושגה"** — היום זה רק chip ירוק. אפשר toast חד-פעמי עם confetti ברגע ש-`bestStreak` עובר את `min_streak_periods` (לזכור ב-localStorage שהוצג כבר).

8. **"Freeze days"** — סטריק סלחני יותר: לאפשר X "ימי הקפאה" בתקופה (כמו Duolingo) שאין בהם השלמה אבל הסטריק לא נשבר.

### C. נושאים מהסשנים הקודמים שעדיין פתוחים

(מהקטעים למטה ב-MD הזה — נשארו פתוחים ולא נגענו בהם בסשן הזה.)

- Drag-to-nest ב-GanttTable (#1 ישן).
- Custom fields ב-Gantt column manager (#2 ישן).
- Schedule מ-timeline ב-Gantt (#3 ישן).
- בדיקת Daily Brief AI עם v7 (#4 ישן).
- מסך פרויקטים / הקלטות / מחשבות / זמן עבודה (#5–6 ישנים).
- Bundle size / code-splitting (#7 ישן).

---

## פרומט להפעלה בסשן הבא

> בסשן הקודם השלמנו שני מסלולים גדולים: (1) תמונות למנות + מסך תפריט אינטראקטיבי (Wolt-like) ב-Food, ו-(2) פיצ'ר יעדים/הרגלים מלא (סכמה + מסך `/app/goals` + ווידג'טים בדשבורד + חישובי סטריק/X-of-Y/זמן/missing-beats). הכל ב-main, פרוס. קראי את `NEXT_STEPS.md` (סשן 2026-05-06 בראש), ספציפית את **חלק A — AI placeholders שמחכים לחיווט**. אני רוצה לעבור לחיווט ה-AI: שני כפתורי "בקרוב" ב-Food (`הצע תמונה` ב-MealEditModal ו-`הצע תפריט` ב-InteractiveMenuTab) צריכים להיהפך לפיצ'רים אמיתיים. תתחילי בלשאול אותי איזה ספק AI אני מעדיפה לכל אחד (Anthropic Claude לטקסט / OpenAI gpt-image-1 או Unsplash לתמונות / הצעה אחרת), ואיפה לאחסן את ה-API keys (Edge Function secret? Supabase Vault?). אל תתחילי לקודד עד שאישרתי את ה-stack. אחרי שאישרתי, בואי נעבוד שלב-שלב: (1) הצע תמונה ב-MealEditModal עם flow שלם של preview + "החלף", (2) הצע תפריט שמייצר preview ניתן לעריכה לפני שמירה, (3) חיווט "הצעה לפי שם המנה" אם נשאר זמן.

---

## (היסטוריה — סשנים קודמים)


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
