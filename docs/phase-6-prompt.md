# פאזה 6 — Prompt לפתיחת צ'אט חדש

> העתק את כל מה שמתחת ל-`---` הראשון ועד הסוף, הדבק כהודעה ראשונה
> בצ'אט החדש (כולל הקריאה ב-SPEC.md וב-claude-integration.md).

---

# שלום! ממשיכים מהאפיון של Multitask לפאזה 6.

## הקשר ל-AI

לפני כל דבר אחר — קרא את שני המסמכים האלה במלואם:

1. **`SPEC.md`** — האפיון המלא. Section 18 (מסך הקלטות), Section 8
   (AI + הקלטות + אחסון) ובמיוחד **Section 28 #9** (אין סודות חיצוניים
   בדפדפן). את ה-Changelog בסוף קרא **מהסוף להתחלה** — שם רשומות כל
   ההחלטות הארכיטקטוניות שנקבעו בסשנים הקודמים, וההחלטה האחרונה
   (Cloudflare R2 + adapter pattern דו-שכבתי) קריטית לפאזה 6.
2. **`docs/claude-integration.md`** — אם נחליט לחבר את ה-AI האמיתי
   במקביל. כרגע ה-AI במסך מחשבות הוא mock דטרמיניסטי
   (`src/lib/ai/thought-suggestions.ts`); המעבר ל-Claude Haiku
   חי שם כתוכנית מוכנה.

## מצב נוכחי (סיום פאזה 5)

הסתיימו פאזות 3 (משימות), 4 (יומן + Gantt), 5 (מחשבות) **ושני גלי
polish גדולים**. הכל מוזג ל-`main`. ה-PR האחרונים שמוזגו: #43-#45
(לוח שנה — גרירה, שינוי גודל בקצוות סגנון Gantt, pill חי בזמן גרירה,
ותיקון nested-button HTML שגרם ל-dragstart להישבר בכרום בתצוגת חודש).

חוב טכני שעבר לפאזה 6 (מתועד ב-Changelog בסוף ה-SPEC):
- `EntityEditModal` משותף ל-task/event (חוב פתוח 2 פאזות).
- `projects.source_thought_id` עמודה — מחשבה שיולדת פרויקט עדיין לא
  נרשמת ב-`projects`, רק ב-`thought_processings`.
- DashboardGrid מלא ליומן (CalendarStatsStrip הוא stand-in).
- גרירה של מופעי RRULE שגוררת את כל הסדרה (חסום כרגע).

## פאזה 6 — מה אנחנו בונים

### 6א. תשתית אחסון Cloudflare R2 (קריטי — חוסם את 6ב)

ההחלטה תועדה ב-Changelog ("2026-04-24 — החלטת ארכיטקטורה"). מימוש:

1. **משתמשת תייצר ב-Cloudflare:**
   - חשבון R2 + bucket בשם `multitask-recordings`.
   - API token עם הרשאות לקריאה/כתיבה לאותו bucket בלבד.
   - **CORS על ה-bucket:** AllowedOrigins = production domain +
     `localhost:5173`; AllowedMethods = PUT/POST/GET/HEAD;
     AllowedHeaders = `*`; ExposeHeaders חייב לכלול `ETag`.
   - **Public Bucket = OFF.** הקלטות פרטיות דרך presigned-GET.

2. **משתמשת תייצר Supabase secrets** (לא `VITE_*`):
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
     `R2_BUCKET_NAME`.
   - `VITE_R2_PUBLIC_URL` ניתן להוסיף ל-`.env` של הדפדפן (זה לא סוד,
     זה ה-public URL).

3. **קוד שאני בונה:**
   - `supabase/functions/storage/index.ts` — Edge Function (Deno) עם
     שלוש endpoints:
     - `POST /presign-upload` → presigned PUT URL לקובץ קצר.
     - `POST /presign-multipart` → CreateMultipartUpload → מחזיר
       upload-id + presigned URLs לכל ה-parts.
     - `POST /complete-multipart` → CompleteMultipartUpload עם
       רשימת ETags.
     - `POST /abort-multipart` → AbortMultipartUpload בעת ביטול.
   - הסודות ב-Supabase secrets, ה-AWS S3 SDK חי רק בתוך ה-Edge
     Function. **אין AWS SDK בדפדפן.**
   - JWT verification: רק יוזרים מאומתים ובארגון פעיל יכולים לקבל
     presigned URLs.
   - `src/lib/services/storage.ts` — thin client בדפדפן שקורא ל-
     Edge Functions. ממיר file/blob ל-multipart upload עם chunks
     של ~5MB / ~2 דק' (מה שקורה קודם).
   - `src/lib/hooks/useFileUpload.ts` — hook עם progress + cancel
     + retry.
   - **IndexedDB persistence** ל-chunks: כל chunk נכתב ל-IndexedDB
     (`useIndexedDbChunks`) ונמחק רק אחרי ack מ-R2. tab crash →
     טעינה משחזרת את ה-multipart הפתוח.

4. **מיגרציה לסכמה** — `recordings`:
   - `storage_key text` (לא `storage_path` — זה key של object store).
   - `storage_provider enum ('r2' | 'supabase') default 'r2'`.
   - `multipart_upload_id text` — שונה מ-NULL רק בזמן הקלטה פעילה.
   - `status` יקבל ערך חדש `'recording'` (לפני `'uploaded'`).

5. **cron לניקוי multiparts נטושים:** Edge Function שרצה פעם ביום
   ועושה `AbortMultipartUpload` לכל multipart שפתוח > 24 שעות.

### 6ב. מסך הקלטות (§18)

לאחר שתשתית R2 חיה ועובדת:

1. **רשימת הקלטות** — `useRecordings()` עם סטטוס + משך + דוברים.
2. **אזור Drop** — גרור קובץ MP3 → `useFileUpload` → presigned PUT
   ל-R2 → רשומה ב-`recordings` עם `status='uploaded'`.
3. **הקלטה ישירה מהדפדפן** — `MediaRecorder` API:
   - לחיצה על FAB 🎤 (כבר קיים ב-§12.5) → `RecordingDialog` נפתח.
   - Multipart upload **מההתחלה** — לא מחכים ל-stop. כל chunk של
     ~5MB / ~2 דק' שולח ישירות ל-R2.
   - `XHR.upload.onprogress` למד התקדמות בסרגל; ה-recorder לא
     יודע שיש העלאה ברקע.
   - ביטול → `AbortMultipartUpload` + ניקוי IndexedDB.
   - ההקלטה לא נעצרת לעולם בגלל איטיות-רשת — ה-chunks ממתינים
     ב-IndexedDB ומשתחררים כשהרשת חוזרת.
4. **נגן** — `<audio>` עם presigned-GET ל-R2 (תוקף 1 שעה).
5. **תמלול** — ספק Gladia (interface כבר ב-`adapter pattern` ב-§8).
   הספק משובץ כ-Edge Function נוספת (`supabase/functions/transcribe`)
   עם `GLADIA_API_KEY` ב-Supabase secrets — שוב **לא בדפדפן**.
6. **חילוץ משימות** — אחרי תמלול, Edge Function שלישית קוראת ל-
   Claude Haiku עם הפרומפט "מצא משימות בתמלול הזה" → רשימה של
   `recording_tasks`. הספק כבר מאחורי interface ב-§8.
7. **תיוג דוברים** — `recording_speakers` (עכשיו טריוויאלי כי
   Gladia מחזיר speaker_index).

**סדר עדיפות בתוך 6ב:** קודם upload (drag-drop), אחר כך הקלטה
ישירה, אחר כך נגן, אחר כך תמלול אינטגרטיבי. כל שלב הוא PR נפרד
ושמיש בפני עצמו.

### 6ג. שני חובות טכניים קטנים (פאזה 5 → 6)

1. **`projects.source_thought_id`** — מיגרציה קצרה שמוסיפה את
   העמודה. עדכון `useCreateProject` לתעד אותה כש-`createDraft`
   מגיע ממחשבה. ב-`ProjectEditModal` (פאזה 7?) להוסיף לינק "← נוצר
   מהמחשבה" כמו במשימה ובאירוע.

2. **`EntityEditModal` משותף** — refactor של `TaskEditModal` +
   `EventEditModal` ל-modal אחד עם tabs דינמיים בהתאם ל-kind.
   זו עבודה גדולה; אם פאזה 6 כבר עמוסה, לדחות לפאזה ליטוש.
   **אבל** — לפחות לחלץ primitives משותפים (DateTimePicker,
   DurationInput, TagsInput וכו') לתיקיה `components/entity-form/`.

## כללים שצריך לזכור

ה-CLAUDE.md / SPEC.md מכילים את זה במפורש, אבל לדגש:

- **כתוב בעברית** באינטראקציה איתי.
- **ענף פיתוח** — צור branch חדש מ-`main` לכל PR נפרד; אל תדחוף ישירות
  ל-main.
- **לא להוסיף `@dnd-kit` לזרמי דאטה חדשים** אם native HTML5 drag עובד
  (ראה Changelog פאזה 5 polish — calendar drag).
- **לעולם לא `<button>` בתוך `<button>`** — תמיד `<div role="button">`
  כשיש ילד שהוא button.
- **לעולם לא env var עם `VITE_*` עם סוד.** הסוד חי ב-Supabase secrets
  + Edge Function מחזיק את ה-SDK. הדפדפן מקבל presigned URL.
- **כל מיגרציה** הולכת ל-`supabase/migrations/` עם prefix של תאריך
  (`YYYYMMDDHHMMSS_description.sql`). לעולם לא לשנות מיגרציה שכבר
  הוחלה — תוסיף מיגרציה חדשה שמתקנת.
- **כשל מיגרציה גלוי** — אם feature חדש דורש מיגרציה שאולי לא הוחלה,
  ה-UI חייב להציג שגיאה inline עם המסלול לקובץ ה-SQL במקום fail
  שקט. (זה pattern שכבר קיים ב-`DayNoteDialog` ו-`EventCalendarEditDialog`.)
- **MCP של GitHub** מוגדר ל-`haroshccc/multitask`. השתמש ב-
  `mcp__github__create_pull_request` ו-`mcp__github__merge_pull_request`
  אחרי שהמשתמשת מאשרת.
- **Build חייב לעבור** לפני commit (`npm run build`).
- **תקן לפי root cause, לא ב-`--no-verify`** — אם hook נכשל, תפתור.

## הצעדים הראשונים שלך כשנפתח את הצ'אט

1. קרא `SPEC.md` במלואו (במיוחד Changelog בסוף, §8, §18, §28).
2. קרא `docs/claude-integration.md` (כי ייתכן ונחבר את Claude
   באותה פאזה).
3. ספר לי בקצרה (≤ 200 מילים) מה הבנת מהאפיון, ומה הצעד הראשון
   שאתה מציע לפאזה 6 — כן/לא לפצל ל-6א/6ב/6ג.
4. **חכה לאישור שלי** לפני שאתה כותב קוד. אנחנו עובדות יחד —
   קודם תיאום, אחר כך מימוש.

## משאבי עזר נוספים בפרויקט (אם נחוצים)

- `supabase/migrations/` — כל המיגרציות ההיסטוריות. ראה איך הן בנויות.
- `src/lib/hooks/index.ts` — barrel exports של כל hooks הדאטה.
- `src/components/calendar/calendar-drag.ts` — דוגמה למודול drag
  שעובד ב-vanilla HTML5; ייתכן ויהיה רלוונטי לתבנית "תלות מודולרית
  + portal" שאצטרך גם בהקלטות (עבור recording overlay למשל).

תודה! מצפה לעבודה.
