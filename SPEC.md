# Multitask — אפיון מלא

> מסמך זה הוא **מקור האמת היחיד** לכל החלטה שהתקבלה בשיחת האפיון.
> כל סתירה בין הקוד לאפיון — האפיון גובר עד שהמשתמש החליט אחרת במפורש.
> עריכות: לרכז כל שינוי החלטה תחת "Changelog" בתחתית, עם תאריך.

---

## 1. סקירה כללית

**Multitask** — אפליקציית פרודוקטיביות בעברית (RTL), רב־משתמשים, מבוססת ארגונים.
קהל יעד: פרילנסרים/בעלי עסק קטן שמנהלים פרויקטים, לקוחות, שיחות עבודה ומחשבות במקום אחד.

### כלל־הזהב הארכיטקטוני
זו **לא** אפליקציה של כמה מסכים מנותקים. זו **מערכת אחת** שבה לכל ישות (task, recording, project, thought, event) יש טבלה אחת ב־Supabase, והיא מופיעה בכל המסכים שרלוונטיים לה. שינוי במסך אחד = עדכון מיידי בכולם דרך Supabase Realtime.

### הפרדה מנטלית
- `design-language.html` = **איך** הכל נראה (צבעים, פונטים, צללים, רדיוסים, טוקנים). לא מקור פיצ'רים.
- מסמך זה = **מה** כל מסך עושה. לא מקור עיצובי.

---

## 2. Stack טכני

| שכבה | בחירה | למה |
|------|-------|-----|
| Frontend | Vite + React + TypeScript | מהיר, פשוט, תואם ל־design-language ב־HTML/CSS 1:1 |
| Routing | React Router | Vite לא תומך ב־App Router של Next |
| Styling | Tailwind + tokens מ־design-language | RTL native בדפדפן |
| Mobile | Capacitor | אותו קוד רץ באתר + iOS + Android |
| DB / Auth / Realtime / Storage | Supabase | הכל במקום אחד |
| State UI | Zustand + zundo (Undo/Redo) | קל, תואם ל־React Query |
| Server state | TanStack Query (React Query) | cache + invalidation + optimistic |
| Tables | TanStack Table v8 | עמודות דינמיות, virtualization |
| Drag & Drop | @dnd-kit | RTL מלא, גם שורות וגם עמודות, עץ |
| Dashboard widgets | react-grid-layout | auto-pack, responsive, drag + resize |
| Gantt | Custom (CSS Grid + SVG) | שליטה מלאה ב־RTL ובטוקנים |
| Calendar UI | FullCalendar או custom | תלוי עומק התאמה |
| Transcription | Gladia (start) → ivrit.ai אופציה | עברית + diarization באותו API |
| LLM | Claude Haiku 4.5 | זול, מהיר, structured output בעברית, prompt caching |
| Push notifications | OneSignal | Web + iOS + Android בשכבה אחת |
| WhatsApp | Meta Cloud API (ישיר) | ללא markup של Twilio |
| Calendar sync | Google Calendar API (service account) | יומן read-only per user |
| Meet | Google Meet API (`meetings.space.created` scope) | יצירת שיחות בשם המשתמש |

### למה לא React Native / Expo
- design-language מבוסס HTML/CSS → StyleSheet של RN שובר נאמנות עיצובית.
- RTL עברית ב־RN = כאב ראש ידוע; בדפדפן זה `dir="rtl"` ונגמר.
- Supabase Realtime + React Query עובדים אותו דבר בשני העולמות — אין יתרון ל־RN.

---

## 3. סדר הבנייה

> **סטטוס נכון ל-2026-04-27:** פאזות 1-2 (תשתית) + פאזה 3 (משימות)
> + פאזה 4 (יומן + Gantt) + פאזה 5 (מחשבות) + **פאזה 6א (R2)
> + פאזה 6ב (UI הקלטות)** מוזגו ל-main. **פאזה 6ג שלב 1
> (Gladia)** קיימת בקוד (`supabase/functions/transcribe` +
> `transcribe-webhook` + `RecordingPlayer.TranscriptionSection`)
> ומחכה ל-`GLADIA_API_KEY` + `GLADIA_WEBHOOK_TOKEN` ב-Supabase
> secrets ולפריסה. נותר **פאזה 6ג שלב 2 (Claude Haiku — סיכום +
> חילוץ משימות)**. אחרי 6ג: פאזה 7 = מסך פרויקטים / תמחור (#14).
> פירוט מלא בכל פאזה בסוף ה-SPEC ב-Changelog.

1. ✅ Design tokens מ־`design-language.html`
2. ✅ Types משותפים
3. ✅ Supabase schema + RLS + Realtime + seeds
4. ✅ Services + React Query hooks
5. ✅ Layout בסיסי (Topbar + Sidebar + Routing)
6. ✅ **DashboardGrid infrastructure** (רוחבי)
7. ✅ **FilterBar infrastructure** (רוחבי)
8. ✅ **Lists Banner** (רוחבי למשימות/יומן/Gantt)
9. ✅ מסך משימות *(פאזה 3)*
10. ✅ מסך יומן *(פאזה 4 + 4.1 polish + פאזה 5 polish)*
11. ✅ מסך Gantt *(פאזה 4)*
12. 🟡 מסך הקלטות *(פאזה 6א + 6ב; **6ג פתוח** — Gladia + Claude)*
13. ✅ מסך מחשבות *(פאזה 5; קדם להקלטות בכוונה כי ההקלטות תלויות ב-R2)*
14. ⏭ **מסך פרויקטים / תמחור** — הפאזה הבאה (פאזה 7)
15. ⬜ מסך דשבורד הבית
16. ⬜ הגדרות + Admin
17. ⬜ Landing אינטראקטיבי

כל מסך: commit + push + merge ל־main.

---

## 4. ענף פיתוח

- עובדים על `claude/build-multitask-app-HC7D4` (או הענף הנוכחי של הסשן).
- אחרי כל מסך שמוכן — merge ל־`main` כדי שהאתר החי יתעדכן.
- אין dev ישיר על `main`.

---

## 5. Auth + ארגונים

### מודל
- **רב־משתמשים.** כל משתמש רואה רק את הדאטה שלו.
- כל משתמש שייך ל**ארגון אחד לפחות**. הדאטה מסוננת לפי ארגון.
- **Google OAuth בלבד.** בלי אימייל+סיסמה ביתית (הוחלט מפורשות — מוריד אבטחה, מוסיף שטח תקיפה).
- אם בעתיד נרצה רדונדנטיות — Apple Sign-In או Microsoft OAuth (שניהם באיכות ארגונית).

### זרימת רישום
1. `Continue with Google` → Supabase Auth.
2. אם אין למשתמש שורה ב־`organization_members` → מסך "הצטרף / צור ארגון":
   - **הצטרף לארגון קיים:** שם ארגון + סיסמת הצטרפות (bcrypt verify).
   - **צור ארגון חדש:** שם + סיסמת הצטרפות → המשתמש נרשם כ־`owner`.
3. אם דומיין המייל מזהה `suggested_domain` של ארגון קיים → pre-fill שם הארגון (UX בלבד, עדיין דורש סיסמה).
4. מהרישום הראשון ואילך — כניסה = ישר לאפליקציה.

### שיתוף דאטה
- ברירת מחדל: פריט חדש = פרטי ליוצר.
- שיתוף = בחירת משתמשים ספציפיים **מתוך אותו ארגון בלבד**.
- אין שיתוף חוצה־ארגונים (נדון ונדחה — פותח מורכבות OAuth כבדה).
- טבלת `shares` פולימורפית משותפת לכל הישויות.

### RLS ראשי (כל טבלת דאטה)
```sql
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
)
```
+ policy משני דרך `shares` לפריטים ששותפו.

---

## 6. Billing hooks (נדחה בכוונה)

לא בונים אינטגרציה עכשיו, אבל **הסכמה מוכנה** כדי שלא תידרש מיגרציה כואבת.

### שדות
על `organizations` ועל `profiles`:
```
plan text default 'free'                     -- 'free' | 'pro' | 'enterprise'
subscription_status text default 'active'    -- 'active' | 'past_due' | 'canceled' | 'trialing'
trial_ends_at timestamptz
billing_customer_id text
current_period_end timestamptz
```

פונקציית עזר `canUseFeature(scope_id, feature)` שכרגע מחזירה `true`. ביום שיחובר billing — מחליפים את הלוגיקה שלה בלבד, UI לא משתנה.

### מה לא בונים עכשיו
- אינטגרציה עם Stripe / Paddle / LemonSqueezy.
- Webhooks של subscription lifecycle.
- UI לחשבוניות / שדרוג מסלול.
- טיפול VAT.
- Paywalls על פיצ'רים.

### כשנחזור לזה
שווה לשקול **Paddle / LemonSqueezy** מול Stripe — הראשונים merchant of record וטופל VAT עבורך. Stripe נותן יותר שליטה אבל אתה אחראי למס.

---

## 7. משתמש־על (Super Admin)

### מה הוא יכול
- לראות את כל הארגונים במערכת.
- ליצור / לערוך / לארכב ארגונים.
- להעביר משתמשים מארגון לארגון.
- לשנות שמות תצוגה של משתמשים.
- לאפס סיסמאות הצטרפות של ארגונים.
- להשעות / לבטל חשבונות.
- לראות סטטיסטיקות מערכת: משתמשים, אחסון, עלויות AI, פעילות.
- להתחזות זמנית למשתמש (תמיכה) — עם audit log מלא.

### סכמה
```
profiles
  + is_super_admin boolean default false    -- נשתל ידנית ב-SQL

super_admin_audit_log
  id, admin_user_id,
  action text,                 -- 'moved_user_org', 'reset_org_password', 'impersonated', ...
  target_type, target_id,
  details jsonb,
  ip_address inet,
  created_at
```

### אבטחה
- הדגל `is_super_admin` נשתל רק ב־SQL direct (אף אחד לא יכול להעלות את עצמו).
- כל פעולה עוברת דרך Supabase RPC עם `SECURITY DEFINER` שבודקת את הדגל.
- כל פעולה נרשמת ב־audit log.
- מסך `/admin` ב־sidebar רק אם `is_super_admin = true`.

---

## 8. AI + הקלטות + אחסון

### ספק תמלול
- **Gladia** להתחלה: עברית + diarization + webhooks באותו API.
- **Adapter layer** (`TranscriptionProvider` interface) — החלפת ספק = יום עבודה, לא שבוע.
- חלופות למקרה שהאיכות לא מספקת: ivrit.ai (עברית fine-tune ל-Whisper, self-host ב-Replicate) / Deepgram Nova-3 / AssemblyAI.

### LLM לעיבוד
- **Claude Haiku 4.5** — חילוץ משימות, סיכומים, הצעות AI במחשבות.
- תומך prompt caching (חוסך כסף עם system prompt גדול).
- Structured output בעברית.

### זרימה — חובה אסינכרוני
Supabase Edge Function מוגבל ל-400 שניות. שיחה של 1.5 שעה = כמה דקות תמלול. חייבים webhooks.

```
1. Client:   POST /functions/v1/storage-presign-multipart  → uploadId + part-URL לראשון
2. Client:   PUT chunks ישירות ל-R2 (כל ~5MB) — מקביל להקלטה
3. Client:   POST /functions/v1/storage-complete-multipart → publicUrl + DB row
4. Client:   POST /recordings/:id/process
5. EdgeFn:   שולח URL ל-Gladia עם webhook callback
6. Client:   רואה status "מתמלל..." דרך Realtime
7. Gladia:   webhook מחזיר transcript + speakers + timestamps
8. EdgeFn:   Claude Haiku → {summary, my_tasks, their_tasks, speakers_hint}
9. DB:       נשמר, Realtime מעדכן UI
10. User:    רואה recording ready, מתייג "זה אני / זה דני לקוח"
11. On tag:  משימות משויכות לדוברים הנכונים, נכנסות ל-tasks
```

### דוברים
- **לא מגבילים ב-API.** הגבלה = פגיעה באיכות (המודל כופה איחוד).
- ב-UI: אם זוהו יותר מ-5 → אזהרה "זוהו N דוברים, אפשר לאחד ידנית".
- כלי UI: "Speaker 3 ו-Speaker 5 הם אותו אדם" → לחיצה אחת מאחדת.

### מגבלות קלט
| פרמטר | ערך |
|-------|-----|
| פורמט | אודיו (MP3 / M4A / WAV / WebM) **או וידאו** (MP4 / MOV / WebM). Gladia מחלץ את ערוץ האודיו אוטומטית מווידאו. |
| מקסימום אורך | 3 שעות קשיח |
| רמז UI מעל 90 דק' | "הקלטה ארוכה — תמלול עשוי לקחת 5-10 דקות" (לא חוסם) |

### ספק אחסון — Cloudflare R2 *(החלטה: 2026-04-24, פאזה 5)*

**R2 משמש לכל הקבצים** (אודיו של הקלטות, אודיו/תמונות/קבצים של מחשבות
מ-WhatsApp, צירופים למשימות). **Supabase Storage לא בשימוש.** הסיבה:
egress חינם של R2 + תמחור צפוי לעומת ה-bandwidth bill של Supabase
Storage שצומח עם streaming של אודיו ארוך.

**עיקרון אבטחה קריטי (§28 #9):** סודות R2 **אף פעם לא נחשפים לדפדפן**.
ה-AWS S3 SDK רץ אך ורק ב-Supabase Edge Functions. הדפדפן מקבל presigned
URLs קצרי-טווח (5-15 דקות) ומעלה ישירות ל-R2 איתם. הסיבה: כל
`VITE_*` env-var נחבט ל-bundle ונחשף לכל מבקר ב-DevTools — נסיון להשתמש
ב-`VITE_R2_SECRET_ACCESS_KEY` הוא היכן שאיבדנו את הדלי.

**ארכיטקטורה — ת"ב adapter (`StorageProvider` interface):**
- ב-Edge Functions: `CloudflareR2Provider` (AWS SDK v3 + `@aws-sdk/s3-request-presigner`).
- ב-Browser: thin client שקורא ל-Edge Functions (אין SDK).
- 3 endpoints מוגנים-RLS (Edge Functions) שהדפדפן צורך:
  - `storage-presign-upload` — קובץ קטן (PutObject חתום).
  - `storage-presign-multipart` — קובץ גדול (CreateMultipartUpload + presign של החלק הבא).
  - `storage-complete-multipart` — סוגר multipart, רושם row ב-DB.

**משתני סביבה:**
- **בדפדפן (`VITE_*`):** `VITE_R2_PUBLIC_URL` בלבד (CDN domain — ציבורי בכל מקרה).
- **ב-Edge Function (Supabase secrets — *לא* `VITE_`):**
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

**הקלטות ארוכות (עד 3 שעות) — multipart מההתחלה + IndexedDB persistence:**
- **לא** "in-memory עד 18 דק' ואז להעלות". הסיכון: סגירת tab בדקה 17 = הקלטה אבודה.
- במקום זה: ברגע שמתחילים להקליט פותחים `MultipartUpload` ל-R2.
  כל chunk של ~5MB (או כל 2 דקות, מה שקורה קודם) → presigned PUT
  ישירות ל-R2 → אישור → drop מהזיכרון.
- במקביל, כל chunk נשמר ב-IndexedDB עד שהוא ack'd מ-R2. tab crash =
  ההקלטה משוחזרת בכניסה הבאה דרך IndexedDB; ה-multipart נמשך.
- ה-UI ממשיך להקליט ללא הפסקה גם בהקלטה של שעה (XHR.upload.onprogress
  ל-progress; ה-recorder לא יודע שיש העלאה ברקע).
- אם המשתמש עוצר אחרי 30 שניות → לחיצה אחת מבטלת את ה-multipart
  (`AbortMultipartUpload` ב-Edge Function) ו-R2 לא חורר GB. אם
  המשתמש עוצר אחרי שעה → `CompleteMultipartUpload` סוגר את הקובץ.

**CORS על ה-bucket** (חובה לקנפג ב-R2 Dashboard):
- `AllowedOrigins`: domain של הפרודקשן + `localhost:5173` לפיתוח.
- `AllowedMethods`: `PUT`, `POST`, `GET`, `HEAD`.
- `AllowedHeaders`: `*` (או לפחות `Content-Type`).
- `ExposeHeaders`: `ETag` (חובה — multipart דורש להחזיר ETag לכל חלק).
- `MaxAgeSeconds`: `3600`.

**Public access:** `Public Bucket = OFF`. הגישה היחידה היא דרך
public URL של ה-CDN (`pub-<id>.r2.dev` או custom domain) — אבל גם
זה דורש שהאובייקט יסומן כ-public בעת ההעלאה. למחשבות פרטיות / משימות
פרטיות נשתמש ב-presigned-GET (5 דק' תוקף) במקום public URL.

### Retention ואחסון
| Source | ברירת מחדל | הערה |
|--------|-----------|------|
| `thought` | 60 יום לאודיו | טקסט/משימות/סיכום נשארים לנצח |
| `call` / `meeting` | לעולם | |
| `other` | לעולם | |

- המשתמש יכול לדרוס ברירת מחדל **פר הקלטה** או בהגדרות.
- Cron יומי (Supabase): `DELETE audio WHERE now() > archive_audio_at` —
  ה-DB מסמן את הרשומה, Edge Function נפרדת מבצעת `DeleteObject` ב-R2.
  המטא־דאטה (transcript / summary / משימות) נשאר.

### מכסות אחסון
- **ברירת מחדל: מאגר משותף לארגון.**
- `organizations.storage_bytes_limit` נקבע לפי plan.
- `organizations.storage_bytes_used` מתעדכן ב-trigger על `recordings`.
- `profiles.storage_bytes_limit nullable` — אם null משתמש במאגר ארגון; אם מאוכלס = מכסה אישית נוספת (תוספת בתשלום בעתיד).

### מגבלה חכמה
בעליית קובץ: אם `used + size > limit` → חוסם עם הצעה "שדרג מסלול / מחק הקלטות ישנות".

---

## 9. אינטגרציית יומן Google

### החלטה
**מראה read-only פר-משתמש** (לא פר-ארגון), שיושב ב-Google Workspace שלנו וחשוף לצפייה בלבד למייל המשתמש.

### למה לא סנכרון דו־כיווני
נבחן ונדחה. Option A (diff/merge עם אישור שינויים) היה מורכב מדי:
- 3-4 שבועות פיתוח + שנים של באגי edge cases.
- UX מתסכל: "תאשר 23 שינויים" כל פעם.
- סותר "מקום אחד להתנהל בו".

### למה לא יומן בחשבון המשתמש
נבחן ונדחה. Option שנייה (scope `calendar.events` + יומן בחשבון המשתמש):
- דרושה הסכמה רגישה ב-OAuth.
- אחסון refresh tokens מוצפנים.
- edge cases של עריכה/מחיקה בגוגל.
- ויתור על הזמנות חיצוניות ממילא נדרש (החלטת משתמש) → ירדה ההצדקה.

### ארכיטקטורה סופית
1. חשבון **Google Workspace Business Starter** אחד לכל המערכת (~$6/חודש).
2. לכל משתמש שנרשם: EdgeFn יוצר יומן ייעודי "Multitask" **בחשבון שלנו** דרך Calendar API.
3. היומן משותף לצפייה בלבד עם מייל המשתמש.
4. המשתמש רואה אותו ב-Google שלו כיומן מנוי → טלפון, שעון, Outlook, web.
5. Google כופה read-only (המשתמש לא הבעלים) — אין edge cases של עריכה/מחיקה בגוגל.

### Push ליומן
- כל `event` שנוצר באפליקציה → push ליומן המשתמש.
- משימה עם `scheduled_at` → push ליומן כ-event. משימה ללא תזמון → לא בגוגל.
- Prefix חזותי `📋` לכותרות משימה (להבחנה מאירועים).
- שיתוף פנים־ארגוני: אותו אירוע נדחף ל־N יומנים (של כל המשתתפים).

### שיתוף אירועים
- **רק בתוך הארגון** (החלטה מפורשת של המשתמש — לוותר על חיצוניים לשם פשטות).
- Autocomplete מתוך `organization_members`.
- RSVPs: נעשים **באפליקציה**, לא בגוגל. (הולם read-only טבעי.)
- אין `email` חופשי, אין `is_external` — הכל דרך `user_id`.

### סכמה
```
profiles
  + google_mirror_calendar_id text
  + google_mirror_shared_at timestamptz

events
  id, organization_id, owner_id,
  title, description,
  starts_at, ends_at, all_day boolean,
  location,
  video_call_url text nullable,
  video_call_provider ('meet'|'zoom'|'teams'|'other'|null),
  google_event_ids jsonb,              -- map: user_id → google_event_id (אותו event חי בכמה יומנים)
  source_recording_id nullable,
  source_thought_id nullable,
  created_at, updated_at

event_participants
  event_id, user_id,
  rsvp_status ('pending'|'accepted'|'declined'|'tentative'),
  added_at
  -- אין email/is_external — הכל פנים-ארגוני
```

### Google Meet
- **Scope נוסף:** `https://www.googleapis.com/auth/meetings.space.created`. ממוקד, לא מפחיד.
- ב-UI של יצירת אירוע: שדה "לינק וידאו" + כפתור "🎥 צור Meet אוטומטית".
- הכפתור קורא ל-Meet API **בשם המשתמש** → הוא ה-host עם כל השליטה.
- הלינק נשמר ב-`video_call_url`.
- `video_call_provider` מזוהה אוטומטית מה-URL (Meet / Zoom / Teams).
- משתמש יכול להדביק לינק ידנית (Zoom / Teams / לינק קיים) — תמיד עובד.
- אם כבר הודבק לינק ולחצו "צור Meet" → מאשר "להחליף?".
- **תזמון שליחה מראש** (WhatsApp/email) — כפתור קיים ב-UI באפור עם "בקרוב". שריון ל-future.

---

## 10. WhatsApp

### החלטה
**Meta Cloud API ישיר** (לא Twilio — חוסך markup של ~50%).

### מספר עסקי
- **מספר אחד משותף לכל המערכת**, לא פר-ארגון (אחרת אישור Meta פר-ארגון = סיוט).
- דורש verification חד-פעמי של המספר מול Meta (1-3 ימים).
- המשתמש צריך SIM ייעודי או VOIP (Twilio / Plivo $1-3/חודש).

### קלט → מחשבות (inbound)
1. במסך הגדרות: "קשר את ה-WhatsApp שלך" → מקבלים קוד 6 ספרות.
2. המשתמש שולח לבוט: `VERIFY 123456`.
3. השרת מוודא → שומר `whatsapp_phone_e164` על ה-profile.
4. מכאן כל הודעה/קובץ ממנו = `thought` חדש ב-DB שלו.
5. אודיו/תמונה יורדים מ-Meta Media API → Supabase Storage.

### פלט → הודעות (outbound)
**לא שולחים דרך הבוט שלנו.** בחירה מודעת.

הסיבה: WhatsApp אוסר טקסט חופשי יוצא לנמען שלא כתב לבוט ב-24 שעות האחרונות. מותר רק תבניות מאושרות (1-3 ימי אישור פר-תבנית). לא שווה את כאב הראש ל-MVP.

**במקום זה, שתי אופציות בלחיצת משתמש:**
1. **WhatsApp (wa.me)** — פותח `https://wa.me/<phone>?text=<encoded>` → ה-WhatsApp האישי של המשתמש נפתח עם השיחה מוכנה. שולח בעצמו.
2. **מייל** — `mailto:` או Resend API.

יתרונות: מגיע מהמספר האישי (לא מבוט אנונימי), אפס costs, עובד לכל נמען בעולם.

### תזמון שליחה מראש
כפתור ב-UI מסומן "בקרוב" (באפור). שריון ל-future — בעתיד עם תבניות מאושרות ב-Meta.

### סכמה
```
profiles
  + whatsapp_phone_e164 text unique nullable
  + whatsapp_verified_at timestamptz
  + whatsapp_verification_code text nullable   -- TTL 10 דקות

whatsapp_inbound_log
  id, from_phone, raw_payload jsonb, matched_user_id, thought_id, created_at
```

---

## 11. התראות

### ספק
**OneSignal** — Web Push + iOS (APNs) + Android (FCM) בשכבה אחת. חינם עד 10K משתמשים.

### סוגי התראות (התחלה)
- משימה יועדה אלי.
- משימה ממתינה לאישור שלי.
- הוזמנתי לאירוע.
- תזכורת 10 דק' לפני אירוע.
- מחשבה הגיעה מ-WhatsApp.
- הקלטה סיימה עיבוד.
- משימה חרגה מ-deadline.

### בקרה
`user_notification_preferences` — פר סוג, פר ערוץ (in_app / push / email). המשתמש שולט הכל.

### סכמה
```
notifications
  id, user_id, organization_id,
  type enum, payload jsonb, action_url text,
  read_at, created_at

push_tokens
  id, user_id, platform ('web'|'ios'|'android'),
  onesignal_player_id text unique,
  device_info jsonb, last_seen_at

user_notification_preferences
  user_id, notification_type,
  in_app boolean, push boolean, email boolean
```

---

## 12. עקרונות UX רוחביים (חלים על **כל** המסכים)

### 12.1 DashboardGrid — ווידג'טים נגררים
**זה לא פיצ'ר של מסך תמחור. זה מערכת רוחבית על כל מסכי העבודה.**

מסכים עם dashboard grid: תמחור, משימות, יומן, Gantt, הקלטות, מחשבות, דשבורד הבית.

התנהגות כל ווידג'ט:
- ניתן לגרירה למקום חדש.
- ניתן לשינוי גודל (פינה תחתונה).
- ניתן לקריסה / פתיחה.
- ניתן להסתרה (X בפינה) → חוזר דרך "הוסף ווידג'ט".
- **auto-pack** — שאר הווידג'טים מסתדרים אוטומטית סביב התנועה.

ספרייה: **react-grid-layout**. סטנדרט תעשייתי, auto-packing מובנה, responsive (layouts נפרדים מובייל/טאבלט/דסקטופ).

### שמירה
```
user_dashboard_layouts
  user_id,
  screen_key ('dashboard' | 'pricing' | 'tasks' | 'calendar' | 'gantt' | 'recordings' | 'thoughts'),
  scope_id uuid nullable,          -- project_id במסך תמחור, null במסכים אחרים
  layout_desktop jsonb,            -- [{i: 'tasks_table', x: 0, y: 0, w: 12, h: 4}, ...]
  layout_tablet jsonb,
  layout_mobile jsonb,
  widget_state jsonb,              -- { tasks_table: {collapsed: false}, ... }
  updated_at
  PRIMARY KEY (user_id, screen_key, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
```

### ברירות מחדל
- כל מסך מגדיר layout ברירת מחדל בקוד.
- משתמש חדש → מקבל את זה.
- כפתור "אפס לברירת מחדל" בתפריט כל מסך.

### מובייל
- react-grid-layout מוריד הכל לעמודה אחת לפי `order` שמור.
- גרירה עובדת גם בטאץ'.

### 12.2 FilterBar — סינון מקסימאלי פר-מסך
**הוראת משתמש מפורשת:** "בכל העמודים צריכה יכולת סינון מקסימאלית".

קומפוננטה משותפת `<FilterBar>` על **כל** מסך עבודה. כל מסך מגדיר אילו פילטרים זמינים לו.

```
┌────────────────────────────────────────────────────────┐
│ [🔽 סנן]  [דחיפות: ⭐⭐⭐+]  [תג: לקוח א]  [× נקה]    │
│                                                        │
│ שמורים: [השבוע שלי ▼]  [שמור סינון נוכחי...]          │
└────────────────────────────────────────────────────────┘
```

פילטרים פר מסך:

| מסך | פילטרים |
|-----|--------|
| משימות | סטטוס · פרויקט · רשימה · תאריך יעד · דחיפות · תגים · אחראי · מקור · סטופר פעיל · תלויות · ממתין לאישור |
| יומן | סוגים (משימות/אירועים/שניהם) · רשימות · תגים · מוזמנים · משך · יש/אין Meet |
| Gantt | פרויקט · תאריך · כולל/לא תלויות · critical path בלבד |
| הקלטות | תאריך · משך · מקור · דוברים · ארכוב · יש/אין משימות מחולצות |
| מחשבות | מקור · טקסט/אודיו · מעובדת/לא · משויכת/לא · רשימות · תגים · תאריך |
| פרויקטים | סטטוס · מצב תמחור · לקוח · תגים · ארכוב · בחריגה תקציבית |

### פילטרים שמורים
```
user_saved_filters
  id, user_id, screen_key,
  name text,                    -- "השבוע שלי", "דחוף ללקוח X"
  filter_config jsonb,
  is_default boolean,           -- נטען אוטומטית בכניסה למסך
  sort_order,
  created_at, updated_at
```

### State של הפילטר הנוכחי
נשמר ב-URL query params:
- רענון דף → הפילטר נשאר.
- שיתוף לינק → מקבל את אותה תצוגה.
- "חזור" בדפדפן עובד טבעית.

### 12.3 Lists Banner — משותף ל-3 מסכים
חי ב: **משימות**, **יומן**, **Gantt**.

```
┌─────────────────────────────────────────────────┐
│ רשימות: [🎨 אלפא] [🎯 בטא] [📦 אישי] [+] ⋯     │
│ ▼ רשימות מוסתרות (3)                            │
└─────────────────────────────────────────────────┘
```

- כל רשימה = chip עם אייקון וצבע.
- קליק → toggle תצוגה (שקוף=מוסתר, מלא=מוצג).
- רשימות מוסתרות צונחות לסקציה מקופלת בתחתית.
- **מצב עצמאי פר-מסך** — אפשר להסתיר "אלפא" ב-Gantt אבל להציג במשימות.

ב-יומן ו-Gantt יש בנוסף:
- Toggle משימות / אירועים / שניהם (3-state).
- ב-Gantt: בורר זום (יום / שבוע / חודש / רבעון).

```
user_list_visibility
  user_id, screen_key ('tasks'|'calendar'|'gantt'),
  hidden_list_ids uuid[],
  updated_at
  PRIMARY KEY (user_id, screen_key)
```

### 12.4 Undo/Redo גלובלי
כל מסך עבודה תומך Cmd+Z / Cmd+Shift+Z (וגם כפתורים נראים ב-UI). ספרייה: **zundo** כ-middleware ל-Zustand.

Sync ל-DB ב-debounce 250ms — undo מרגיש מיידי גם אם ה-DB מפגר.

### 12.5 FAB — כפתור צף להקלטה ויצירה מהירה
**הוראת משתמש מפורשת:** "מכל מקום ובשיא הנגישות אני אוכל להקליט או לרשום מחשבה".

צף בפינה של **כל** מסך:
- Desktop: top-right.
- Mobile: bottom-right.

```
  [🎤]  → הקלטה מיידית
  [+]   → תפריט יצירה מהירה
```

### לחיצה על 🎤
Modal קטן:
- כפתור אדום גדול "🔴 הקלטה" — מתחילה מיד.
- תיבת טקסט "או הקלד מחשבה..." מתחתיו.
- Haptic feedback ב-Capacitor (רטט קצר בתחילת הקלטה).
- שקט של 3 שניות → מציע סיום אוטומטי.
- סיום → נשמר כ-`thought` חדש (`source='app_audio'` / `'app_text'`).
- חזרה למסך הקודם אוטומטית.

### לחיצה על +
Dropdown:
```
+ משימה חדשה
+ אירוע חדש
+ הקלטה חדשה
+ מחשבה חדשה
+ פרויקט חדש
──────────
🎤 הקלטה מהירה
```

### קיצורי מקלדת
- `Cmd+K` / `Ctrl+K` → חיפוש גלובלי.
- `Cmd+N` / `Ctrl+N` → תפריט יצירה מהירה.

### 12.6 חיפוש גלובלי
שדה ב-Topbar שמחפש במקביל על:
- משימות · הקלטות · מחשבות · פרויקטים · אירועים · חברי ארגון.

תוצאות מקובצות לפי סוג. קליק = קפיצה לישות.

טכנית: `pg_trgm` או `tsvector` ב-Postgres. עברית נתמכת.

### 12.7 ארכיון 60 יום
עקרון אחיד לכל ישות שניתנת לארכוב (רשימות, פרויקטים):
- סימון `is_archived=true` + `archived_at=now()` + `archive_expires_at=now()+60 days`.
- תצוגה: מוסתרת מברירת מחדל, חשופה בסקציית "ארכיון".
- שחזור: `is_archived=false`.
- Supabase Cron יומי: `DELETE ... WHERE archive_expires_at < now()`.

**משימה אינדיבידואלית לעולם לא נמחקת ישירות.** רק ארכוב רשימה שלמה מסתיר אותן (cascade). אחרי 60 יום → מחיקה פיזית.

### 12.8 Screen Chrome — באנר עליון מאוחד פר-מסך *(הוסף 2026-04-24, פאזה 4.3)*

**עקרון מובייל-ראשית:** במסך העבודה (משימות, יומן, Gantt, הקלטות, מחשבות,
פרויקטים) המשתמש חייב לראות כמה שיותר תוכן-אמיתי וכמה שפחות chrome —
במיוחד במובייל שבו כל pixel יקר.

**היישום:** כל מסך עבודה חייב להיות עטוף ב-*Chrome Bar* אחד דק עם כפתורים
אייקוניים במקום באנרים שפתוחים כל הזמן. כלל הבקרות הרוחביות (רשימות, סינון,
סטטיסטיקות, toggles ספציפיים למסך) נכנסות לתוך ה-Chrome כ:

- **Popover buttons** (רשימות, toggle משימות/אירועים ב-יומן, וכו') —
  לחיצה פותחת חלונית מוצמדת לכפתור, לא באנר שיושב מתחת.
- **Toggle buttons** (סינון, סטטיסטיקות) — לחיצה מציגה את הפנל המלא
  **מתחת** ל-Chrome. לחיצה שנייה מקפלת חזרה.

**ברירת מחדל: הכל סגור.** המשתמש פותח רק מה שנדרש באותה שנייה. המצב של כל
toggle נשמר ב-localStorage תחת `multitask.<screen>.<toggleName>`.

**מימוש קיים:**
- `src/components/calendar/CalendarChrome.tsx` — היומן.
- `src/components/tasks/TasksChrome.tsx` — משימות.
- עקרון: "rule of three" — אחרי המסך השלישי שמשתמש באותו דפוס (Gantt יהיה
  הבא), מוציאים `ToggleButton` / `PopoverButton` ל-`src/components/layout/`.

**מובייל (≤768px):**
- אייקונים בלבד, ללא תוויות טקסט (`md:inline`).
- Popovers `start-0` + `max-w-[calc(100vw-1rem)]` — לא יוצאים מה-viewport.
- פס שני לתוכן שחייב להיות גלוי (למשל טווח תאריכים ביומן).

**דסקטופ (md+):**
- אייקון + תווית טקסט לצידו.
- Popovers יכולים להיות רחבים יותר.
- Chrome יכול להכיל יותר בקרות באותה שורה.

**שדות רעילים לא-להוסיף:**
- גלגל הגדרות מנגנוני-מסך (columns / archive / statuses) הוא **לא** חלק
  מ-Chrome. הוא יושב ב-`ScreenScaffold.actions` (פינת המסך), כי זו הגדרה
  שלוקחים בו פעם בחודש, לא בקליק היומיומי.
- Date nav + view toggle (ייחודיים ליומן/Gantt) יושבים ב-Chrome בצד השני.

---

## 13. ניווט

### Top bar (תמיד גלוי)
```
[Logo] | דשבורד • משימות • יומן • Gantt • הקלטות • מחשבות • פרויקטים | [🔍] [➕] [🎤] [🔔] [👤]
```

### Sidebar
- ברירת מחדל: **מקופלת לאייקונים בלבד**.
- לחיצה / hover → פתיחה לטקסט.
- **מבנה שטוח** (לא היררכי) — בלי drill-down של פרויקטים ב-sidebar.
- ערך מוסף כשפתוחה: quick filters, קיצורי דרך לפילטרים שמורים של המסך הנוכחי.
- **Redundancy מודעת** עם Top bar — כל משתמש יעבוד איך שנוח לו.

### Mobile (Capacitor)
- Top bar בלבד, בלי Sidebar (לא מספיק מקום).
- **Bottom tab bar**: דשבורד · משימות · יומן · מחשבות · + (יצירה מהירה).

---

## 14. מסך דשבורד הבית

מסך בית אחרי כניסה — סיכום של כל המסכים.

### ווידג'טים (כולם נגררים/ניתנים לקריסה/הסתרה)
- **משימות להיום** — עם סטטוס + סטופר מהיר.
- **אירועים קרובים** — היום + מחר.
- **מחשבות לא מעובדות** — עם כפתור "עבד עכשיו".
- **פרויקטים פעילים** — עם progress bar של % ביצוע.
- **התראות אחרונות**.
- **KPI השבוע** — שעות עם סטופר, משימות הושלמו, streak.

### layout ברירת מחדל
Desktop: 3 עמודות. Tablet: 2. Mobile: 1 (כל ווידג'ט מתחת לשני).

---

## 15. מסך משימות

**דגש UX:** זה מסך עבודה. נוחות מקסימלית חובה.

### מבנה — **לא טבלה**. עמודות של רשימות.
```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│              │ פרויקט A │ פרויקט B │ רשימה    │ רשימה    │ ← גלילה
│ לא משויכות   │  (רשימה) │  (רשימה) │ מותאמת 1 │ מותאמת 2 │   שמאלה
│  [ממוקבע]    │          │          │          │          │   לעוד
│              │          │          │          │          │
└──────────────┴──────────┴──────────┴──────────┴──────────┘
```

- 3-4 רשימות גלויות בו־זמנית.
- גלילה אופקית לרשימות נוספות.
- **"לא משויכות"** תמיד בצד, מקובעת → גוררים ממנה לכל רשימה.
- כל רשימה = או פרויקט (אוטומטי) או רשימה מותאמת אישית.
- **Lists Banner** בראש המסך לבקרת נראות (ראה §12.3).

### עץ היררכי בתוך רשימה
```
▾ משימה אם 1               [✓] [⏱] [⋮]
   ▾ תת-משימה 1.1          [✓] [⏱] [⋮]
        • תת-תת-משימה 1.1.1
        • תת-תת-משימה 1.1.2
   • תת-משימה 1.2
▾ משימה אם 2
   • תת-משימה 2.1
```

- כל המשימות = אותה ישות `tasks`. רק `parent_task_id` משתנה.
- עומק לא מוגבל.
- גרירה → קידום/הורדה של רמה (indent/outdent כמו Notion).

### סימון V (הושלמה)
- משימת אם מסומנת → צונחת **לתחתית הרשימה**.
- תת-משימה מסומנת → צונחת **לתחתית תתי-המשימות של ההורה**.
- `completed_at` מאוכלס. אין מחיקה.

### Enter = משימה חדשה
- Enter בסוף משימה → נשמרת + שורה חדשה פתוחה למילוי.
- סדר: `sort_order float` עם רווחים גדולים, הוספה באמצע = ממוצע.

### עריכה מלאה — modal "עריכת משימה"
אותו modal בכל מסך (משימות, פרויקט, יומן, Gantt). כולל:
- כותרת · תיאור · סטטוס · דחיפות (1-5) · תגים.
- תאריך יעד · scheduled_at · duration_minutes.
- אחראי (`assignee_user_id`).
- דורש אישור (`requires_approval`) + מי מאשר.
- הערכת שעות · ספייר (hours).
- משימה חוזרת (RRULE — ראה למטה).
- תלויות (ראה למטה).
- צירופים: הקלטה · מחשבה · אירוע · קובץ · קישור חיצוני · מיקום.
- היסטוריית סטופר (time_entries) — עם עריכה ידנית.

### סטטוסים ואישור סיום
```
todo → in_progress → (אם requires_approval:) pending_approval → done
```
- העברת אחריות = שינוי `assignee_user_id` + התראה לנמען.
- `pending_approval` → האחראי לחץ "סיימתי", ה-approver מאשר/דוחה.

### שיתוף
דרך `shares` פולימורפית. רק בתוך הארגון.

### משימה חוזרת — RRULE
- `recurrence_rule` ב-iCalendar RRULE (הסטנדרט של Google Calendar).
- תומך: כל יום, כל שני וחמישי, ב-1 לחודש, כל שנה ב-15 במרץ, וכו'.
- עריכת מופע בודד → 3 אופציות: "רק זה" / "זה ומה שבא" / "הכל".
- מימוש: master row + virtual instances לפי ה-RRULE; override-ים נשמרים כ-rows נפרדים.

### תלויות בין משימות
```
task_dependencies
  id, task_id, depends_on_task_id,
  relation enum (
    'finish_to_start',   -- מתחילה כשהאחרת נגמרת (default)
    'start_to_start',    -- מתחילות יחד
    'finish_to_finish',  -- נגמרות יחד
    'start_to_finish'    -- נגמרת רק כשהאחרת מתחילה (נדיר)
  ),
  lag_days int default 0
```

- **מעגליות נחסמת בצד שרת** (graph traversal לפני INSERT).
- הסטנדרט של MS Project / Gantt.

### סטופר
- **סטופר אחד פעיל לכל משתמש בכל האפליקציה** (כמו Toggl). הפעלה במשימה B → עוצרת אוטומטית את A.
- ניהול מצב: `profiles.active_time_entry_id` + רענון Realtime.
- סיכום אוטומטי ב-`tasks.actual_seconds` דרך trigger על `time_entries`.
- עריכה ידנית של כל session מתוך ה-modal.

### גרירה ושיתוף בין רשימות
- גרירה של משימה בין רשימות → שינוי `task_list_id`.
- **משימה ברשימה אחת בלבד** (החלטה לצמצום מורכבות). לכפילות → "שכפל לרשימה..." בתפריט ⋯.
- שכפול = רקורסיבי עם כל תתי־המשימות, לא משכפל `time_entries` ולא `processings`.

### מחיקה / ארכיון
- משימה בודדת: **אין מחיקה**.
- ארכוב רק ברמת רשימה: `task_lists.is_archived=true` → cascade לכל המשימות בפנים.
- שחזור תוך 60 יום.

### סכמה
```
task_lists
  id, organization_id, owner_id,
  name, emoji, color,
  kind enum ('project' | 'custom'),
  project_id nullable,              -- מלא רק אם kind='project'
  sort_order int,                   -- סדר אופקי במסך
  is_archived boolean default false,
  archived_at, archive_expires_at,
  created_at, updated_at

tasks
  id, organization_id, owner_id,
  task_list_id uuid nullable,        -- null = "לא משויכות"
  parent_task_id uuid nullable,      -- עץ היררכי
  title, description,
  status enum ('todo'|'in_progress'|'pending_approval'|'done'),
  urgency int check (urgency between 1 and 5),
  tags text[],
  scheduled_at timestamptz,
  duration_minutes int,
  due_at timestamptz,
  estimated_hours decimal,
  spare_hours decimal default 0,
  actual_seconds int default 0,      -- cache מ-time_entries (trigger)
  sort_order float,
  completed_at timestamptz,
  is_event boolean default false,    -- משימה שקוטלגה כ-"אירוע-משימה"
  location,
  assignee_user_id uuid,
  requires_approval boolean default false,
  approver_user_id uuid,
  completion_submitted_at,
  approved_at, approved_by_user_id,
  recurrence_rule text,
  recurrence_ends_at timestamptz,
  recurrence_original_id uuid,       -- אם זה מופע של מאסטר
  source_recording_id, source_thought_id, source_question_id,
  google_event_id,                   -- אם סונכרן ליומן
  custom_fields jsonb default '{}',
  created_at, updated_at

task_dependencies
  id, task_id, depends_on_task_id,
  relation enum (…), lag_days int default 0

time_entries
  id, task_id, user_id, organization_id,
  started_at, ended_at, duration_seconds,
  is_manual boolean, note

task_attachments
  id, task_id,
  attachment_type ('recording'|'thought'|'event'|'file'|'image'|'link'|'location'),
  recording_id, thought_id, event_id,
  storage_path, url, filename, size_bytes, mime_type
```

### שלבים (Phases) — *(הוסף 2026-04-24, פאזה 5)*

**עקרון:** כל משימה ברמת-הרשימה (ללא `parent_task_id`) יכולה להוגדר
כ"שלב" (`is_phase = true`). שלב הוא משימה רגילה לכל דבר — אותה ישות
`tasks`, אותן שדות, אותן עריכות — אבל ויזואלית הוא מייצג **יחידת
זמן-חיים** של חלק מהפרויקט, וסביבו מתקבצות המשימות שייכות אליו (דרך
`parent_task_id = phase.id`).

**כללי שמירה (trigger ב-DB):**
- שלב לא יכול להיות ילד של משימה אחרת (`is_phase=true` ⇒
  `parent_task_id IS NULL`).
- שלב לא יכול להכיל שלב (nested phases אסורים).
- כל משימה רגילה יכולה להיות תחת שלב.
- ניתן להמיר משימה לשלב ולהיפך בכל רגע, גם אם יש לה ילדים.

**ויזואל:**

- **במסך משימות (§15):** שורת שלב עם מסגרת צבועה בצד הלידינג
  (`border-inline-start-width: 4px`), רקע בגוון עדין, font-weight גדול
  יותר, ותג "שלב". ילדים ממשיכים לענות ל-`parent_task_id` כרגיל עם
  `indent`.

- **ב-Gantt (§17):** *Option C hybrid* — שלב מוצג כבלוק צבוע
  (shade של צבע הרשימה). אם הילדים חורגים מהסיום המתוכנן של השלב,
  יש **הארכה אדומה-מקוקווה** (overage) מהסיום המתוכנן עד `max(children.end)`.
  השילוב נותן "תכנון מול מציאות" במבט אחד. שלבים לא משתתפים בחישוב
  Critical Path (הם meta-bands).

- **ביומן (§16):** שלב נספר כ-*multi-day item* אפילו אם משכו קצר,
  ומצויר כ-**רצועת-שלב רחבה** למעלה (מעל תאי הימים בחודש, מעל האזור
  הזמני בשבוע) בצבע ה-shade, עם טקסט "שלב · שם".

**צביעה — גוונים של צבע הרשימה:**
- `generateShades(listColor, 5)` ב-`src/lib/utils/color-shades.ts` —
  5 גוונים סביב הצבע הבסיסי (±16° גוון, ±12% בהירות).
- `pickShade(phaseId, palette)` — hash יציב של ה-id קובע איזה גוון
  מקבל איזה שלב. התוצאה: שלבים באותה רשימה מקבלים גוונים שונים של
  אותה משפחת-צבע → קל להבחין אבל ברור שהם קשורים.

**מעבר מ-SPEC המקורי:**
- §15 תמך רק במשימה ↔ תת-משימה. שלבים מוסיפים שכבה *ויזואלית*
  שלישית ללא שינוי מודל (רק שדה `is_phase`).
- §17 "Critical path" נותר ללא שינוי — מחושב רק על משימות רגילות.
- §16 "multi-day band" מורחב לכלול שלבים גם אם הם קצרים.

---

## 16. מסך יומן

### תפקיד
**בעיקר ויזואליזציה** — לא העיקר של האפליקציה. המשתמש מתנהל במקום אחד (Multitask), היומן מציג את התוצאה.

### תצוגה
- אירועים (`events`) + משימות מתוזמנות (`tasks` עם `scheduled_at`).
- View אחד של יום / שבוע / חודש.
- Lists Banner בראש (ראה §12.3) — כולל toggle משימות/אירועים/שניהם.

### ויזואליזציה של מתוכנן מול בפועל
> **שינוי (2026-04-24, פאזה 4.1):** השפה הזו עודכנה. הגרסה הסמכותית
> כעת היא "אירוע מלא / משימה מתאר בלבד / `time_entries` כבלוק חופף".
> פרטים ב-Changelog תחת "פאזה 4.1".

- ~~**מקווקו** = מתוכנן (scheduled slot).~~  →  **משימה** = קו מתאר בלבד.
- ~~**מלא** = בפועל (סשן `time_entries` שבוצע).~~  →  **אירוע** = בלוק מלא. `time_entries` = בלוק חופף בתוך בלוק המשימה.
- שני השכבות באותה רצועת שעות — מיד רואים חריגות/שינוי. *(עדיין נכון.)*

### גרירה ושחרור — הזזה ושינוי טווח *(הוסף 2026-04-25, פאזה 5 polish)*
- **גרירת בלוק זמני** (יום/שבוע/חודש) → עדכון `scheduled_at` (משימה)
  או `starts_at`/`ends_at` (אירוע) תוך שמירה על משך. snap ל-15 דקות.
- **גרירה בין ימים** (שבוע/חודש) → גם היום וגם השעה מתעדכנים.
  בחודש: רק התאריך זז, שעת היום נשמרת.
- **גרירת פריטי כל-היום ורב-יומיים** → אזור "כל היום" בשבוע + תאי
  חודש משמשים כיעדי שחרור. גרירה משמרת את הטווח (3 ימים נשארים
  3 ימים).
- **שינוי גודל בקצוות (Gantt-style)** — רצועות רב-יומיות מציגות שתי
  ידיות בריחוף: התחלה וסיום. גרירת ידית הסיום ליום אחר → רק ה-end
  משתנה; גרירת ידית ההתחלה → רק ה-start. עבור אירועי כל-היום ידית
  הסיום עוברת ל-midnight של היום שלאחר התא הנשחר (כי `ends_at`
  exclusive).
- **חוסם:** שלבים (phases), מופעים שהורחבו מ-RRULE, פריטי כל-היום
  על השריג השעוני (כדי לא לאבד את דגל ה-all-day בשתיקה).
- **משוב חי בזמן גרירה** — תווית צפה "HH:mm עד HH:mm" עוקבת
  אחרי הסמן ומתעדכנת בכל תזוזה. עבור rsize-end היא מציגה את
  הסיום החדש; עבור resize-start את ההתחלה החדשה; עבור move
  את שני הקצוות.
- **תווית קבועה על כל בלוק/צ'יפ:** "08:00 עד 09:00" מוצג גם בלי
  גרירה — קריאות מיידית של הטווח.
- **בחירת מימוש:** HTML5 native drag (לא `@dnd-kit`) כי הבלוקים כבר
  ממוקמים absolute באופסטים פיקסליים ידועים — drag native מתורגם
  ב-`onDrop` לזמן ע"י reverse-engineering של ה-Y.
- **גוטשה היסטורית:** `<TaskCheckButton>` (button) שובץ בתוך
  `<button>` של בלוק/צ'יפ — HTML לא תקין שגרם ל-`dragstart` להישבר
  בחלק מהדפדפנים. תיקון: הבלוקים והצ'יפים כיום הם
  `<div role="button">` עם תמיכת מקלדת מפורשת (Enter/Space).

### יומני אירועים נפרדים *(הוסף 2026-04-25, פאזה 5 polish)*
- **`event_calendars`** — טבלה חדשה שמפרידה אירועים מרשימות משימות.
  לכל אירוע יש `calendar_id` (FK ל-`event_calendars`) ו-`color`
  אופציונלי לדריסת צבע היומן ברמת אירוע יחיד.
- **קישור דו-כיווני ל-`task_lists`:** `event_calendars.linked_task_list_id`
  ↔ `task_lists.linked_event_calendar_id`. שני שירותים
  (`linkCalendarToList`, `linkListToCalendar`) מנקים את המצביע
  ההפוך לפני קביעת זוג חדש.
- **ויזואליזציה של דריסת צבע ברמת אירוע:**
  - בלי דריסה — מסגרת ומילוי באותו צבע יומן.
  - עם דריסה — **מסגרת** בצבע היומן המקורי, **מילוי** בצבע הדריסה.
    שני הצבעים נשארים גלויים במבט אחד.
- **יצירת יומן inline:** כפתור "+" ליד dropdown היומן ב-EventEditModal
  ובפופאובר הקישור — פותח `EventCalendarEditDialog` ומחזיר את
  ה-id החדש דרך `onSaved(calendarId)` כדי לבחור אוטומטית את היומן
  שזה עתה נוצר.

### Tooltip עם תיאור *(הוסף 2026-04-25, פאזה 5 polish)*
- ה-`CalendarItem` כעת מכיל שדה `description` (נשלף מ-`tasks.description`
  או `events.description`). ה-`title=` של כל בלוק/צ'יפ מציג
  "כותרת\n\nתיאור" (קטוע ל-240 תווים) דרך `itemTooltip(item)`.

### יצירת אירוע — modal
אותו modal שמשמש במסך משימות, רק פתוח על tab "אירוע":
- כותרת · תיאור · מיקום · תאריך/שעה · משך · all-day.
- מוזמנים (autocomplete מתוך ארגון).
- שדה "לינק וידאו" + כפתור "🎥 צור Meet אוטומטית" (ראה §9).
- שיוך לפרויקט / רשימה / הקלטה מקור / יומן + צבע (override אופציונלי).
- חזרה (RRULE).

### סנכרון Google
אוטומטי לפי §9 — אין כפתור סנכרון, הכל קורה ברקע.

### מה **אין** ביומן הזה
- **אין שדה email חופשי** למוזמנים חיצוניים (הוחלט).
- **אין סנכרון דו-כיווני מגוגל** (הוחלט).
- **אין ייבוא אירועים אישיים מהיומן הראשי** — פיצ'ר עתידי אופציונלי.

---

## 17. מסך Gantt

### מיקום
**מסך עצמאי ב-sidebar, ליד מסך היומן.**

### תוכן
- שורות = משימות (עם indent של היררכיית `parent_task_id`).
- ציר אופקי = זמן לפי זום (יום / שבוע / חודש / רבעון).
- בלוקים = משך משימה (`scheduled_at` → `+duration_minutes` או `estimated_hours`).
- **חיצים** = תלויות (`task_dependencies`) — SVG paths.
- Lists Banner + Filters (ראה §12).
- Toggle משימות / אירועים / שניהם (כמו ביומן).

### אינטראקציות
- גרירה אופקית → עדכון `scheduled_at`.
- גרירת קצה → עדכון `duration_minutes`.
- קליק על משימה → modal עריכה מלא.
- **Critical path** — שרשרת התלויות הארוכה שקובעת סיום — מודגשת באפקט חזותי.

### מימוש
**Custom component** (לא ספרייה צד־שלישי):
- CSS Grid + SVG לחצים.
- סיבת בחירה: שליטה מלאה ב-RTL + תאימות ל-design-language tokens.
- זמן בנייה משוער: 3-4 ימים.

---

## 18. מסך הקלטות

### תפקיד
רשימת כל ההקלטות של המשתמש/הארגון, עם סטטוס עיבוד, ואפשרות עריכה/תיוג דוברים.

### ווידג'טים (DashboardGrid)
- **רשימת הקלטות** — עם סטטוס, משך, דוברים, משימות שחולצו.
- **סטטיסטיקות** — שעות שהוקלטו השבוע/החודש, שימוש באחסון.
- **אזור Drop** — גרור קובץ MP3 → העלאה.
- **נגן** — לאחר בחירת הקלטה.
- **תמלול** — טקסט עם timestamps + צבעי דוברים.
- **משימות שחולצו** — לצד התמלול, כל משימה עם highlight של הקטע באודיו.
- **סיכום AI**.

### פעולות על הקלטה
- תיוג דוברים ("זה אני / זה דני לקוח").
- עריכת תמלול ידנית.
- חילוץ משימות מחדש.
- שיוך לפרויקט / רשימה.
- שינוי retention (ברירת מחדל או מותאם).
- ארכיון / שחזור.

### סכמה
```
recordings
  id, organization_id, owner_id,
  title, source enum ('thought'|'call'|'meeting'|'other'),
  storage_key text,                          -- R2 object key (bucket-relative)
  storage_provider enum ('r2'|'supabase'),   -- 'r2' default; 'supabase' שמור לעבר/מיגרציה
  size_bytes, duration_seconds,
  status enum ('recording'|'uploaded'|'transcribing'|'extracting'|'ready'|'error'),
  multipart_upload_id text,                  -- כל עוד ה-multipart פתוח (recording-in-progress)
  transcript_text, transcript_json,          -- עם timestamps + speakers
  summary, language default 'he',
  retention_days,                            -- ברירת מחדל מהמנוי, ניתן לדריסה
  archive_audio_at, audio_archived boolean default false,
  created_at, updated_at

recording_speakers
  recording_id, speaker_index,
  label,                                     -- "אני" / "דני לקוח" / ...
  role ('owner' | 'contact' | 'other')

recording_tasks                              -- קישור
  recording_id, task_id,
  assigned_to_speaker_index,
  extracted_text,
  audio_start_seconds, audio_end_seconds     -- jump back to moment
```

**הערות:**
- `storage_key` (לא `storage_path`) — מסמן שזה key של object store (R2),
  לא נתיב file-system. ה-public URL נבנה כ-`${VITE_R2_PUBLIC_URL}/${storage_key}`.
- `multipart_upload_id` שונה מ-NULL רק בזמן הקלטה פעילה. בסיום
  (`CompleteMultipartUpload`) נמחק. אם נתקע (crash, sigkill) — cron
  ינקה את ה-multiparts הנטושים ב-R2 לאחר 24 שעות.
- `status='recording'` סטטוס חדש לזמן ההקלטה הפעילה (לפני שהקובץ
  סגור). `'uploaded'` = הקובץ ב-R2 מוכן לתמלול.

---

## 19. מסך מחשבות

### תפקיד
המחשבה = **ישות פתקית עצמאית**. מקום לזרוק מחשבה מהר. אחרי עיבוד ב-AI יכולה להוליד דברים אחרים (משימה, אירוע, פרויקט, הקלטה, הודעה) — **ועדיין להישאר קיימת**.

### ערוצי קלט (4)
1. אפליקציה — טקסט.
2. אפליקציה — הקלטה ישירה.
3. WhatsApp — טקסט.
4. WhatsApp — הקלטה / תמונה / קובץ.

כולם נוחתים באותו מקום — טבלת `thoughts`.

### סטטוסים (2 צירים עצמאיים)
| ציר | איך מחושב |
|-----|----------|
| מעובדת / לא מעובדת | `processed_at IS NULL` |
| משויכת / לא משויכת | `EXISTS in thought_list_assignments` |

**אין שדות boolean לסטטוסים** — הכל נגזר. אי אפשר לקבל סתירות.

### רשימות — many-to-many
- מחשבה יכולה להיות **ביותר מרשימה אחת**.
- הוראת משתמש: אינדיקציה ויזואלית — chips של הרשימות + מסגרת עדינה כשיש ריבוי.
- שיוך = גרירה **או** בחירה בתוך עריכה.
- הסרה = X על ה-chip, או drop ל-"אזור הסרה" שמופיע בעת גרירה.

### UX של הקלדה רציפה
```
┌──────────────────────────────────────────┐
│ [textarea ריק, focus אוטומטי]            │
│                                          │
│  [🎤]                          [שלח]    │
└──────────────────────────────────────────┘
```

Flow:
1. מקלידים "להתקשר לדני על ההצעה".
2. Enter →
   - נשמר מיד (אופטימיסטית + paralllel ל-DB).
   - Claude Haiku: כותרת "שיחה עם דני על ההצעה" + timestamp.
   - מופיע למעלה ברשימה.
   - Textarea מתרוקן, focus נשאר.
3. 3 כפתורים צפים על המחשבה שנשמרה:
   ```
   [➕ מחשבה חדשה]  [⚡ עבד מחשבה]  [✓ שמור מחשבה]
   ```
4. לחיצה על "עבד מחשבה" → פותח באנר AI עם הצעות.

### באנר AI
הצעות **קבועות** (תמיד מוצגות):
- המר למשימה / משימות (פיצול).
- המר לאירוע.
- צור פרויקט חדש.
- תמלל (אם אודיו ועדיין לא תומלל).
- סכם.
- שייך לרשימה...
- שלח הודעה.

הצעות **דינמיות** (Claude Haiku מייצר):
- "זיהיתי שם לקוח — שייך לפרויקט X?"
- "זיהיתי תאריך — ליצור אירוע?"
- "זיהיתי 3 פעולות נפרדות — לפצל לשלוש משימות?"

### שרשור הצעות
**כל לחיצה על הצעה → מופעלת, משאירה את שאר ההצעות פעילות.**
```
לחיצה על "צור משימה" →
  ✓ צור משימה — נוצר ✨ [פתח]
  □ צור אירוע
  □ שייך לפרויקט
  □ שלח תזכורת
  ...
```
- ההצעות המופעלות מסומנות V + לינק "פתח" לישות שנוצרה.
- ההצעות שנותרו עדיין פעילות.
- ה-AI לא מעלים אופציות — המשתמש מחליט מתי סיים.
- הצעות חדשות יכולות לצוץ אחרי כל יישום (Haiku מריץ הערכה מחדש).
- סגירת באנר → מציע "סמן כמעובדת? / העבר לארכיון? / השאר פתוחה".

### מיזעור הצעות AI *(הוסף 2026-04-25)*
- ה-`ThoughtAiBanner` כולל chevron מעל רשימת ההצעות. **ברירת מחדל =
  מקופל** — רוב הפתיחות הן "האם ה-AI מצא משהו?" במבט מהיר; משתמש
  פותח כשהוא רוצה לטפל בהן.
- המיזעור משפיע **רק** על הצעות ה-AI ועל "צור הכל"; כפתורי
  "פעולות ידניות" (צור משימה / אירוע / פרויקט / שייך לפרויקט / שייך
  לרשימת מחשבות) נשארים גלויים תמיד.

### Banner משובץ ב-`ThoughtEditModal` *(הוסף 2026-04-25)*
- הטאב "נוצרו מזה" של מודאל-עריכת-מחשבה משבץ את `ThoughtAiBanner`
  עצמו עם `embedded={true}`. כך כל פעולות היצירה (AI + ידני) זמינות
  גם מתוך המודאל, ולא רק מכרטיס המחשבה.
- במצב `embedded` הבאנר מסתיר את ה-X שלו ואת תפריט ה"מה לעשות
  עם המחשבה?" — המודאל המארח כבר מנהל את הסגירה.
- הפעולות מופיעות **מעל** רשימת `thought_processings` הקיימת, תחת
  כותרת "ישויות שכבר נוצרו (N)".

### גרירה כתנועה (drag-as-move) *(הוסף 2026-04-25)*
- גרירת כרטיס מחשבה מעמודה אחת לעמודה אחרת בתצוגת קנבן =
  **העברה** (`unassign` מהמקור + `assign` ליעד), לא העתקה. ה-
  `sourceListId` נישא בתוך ה-drag data כדי שה-drop ידע מה לבטל.
- גרירה לעמודת "לא משויכות" מבטלת את כל השיוכים.
- הכפתור "📎 לרשימה" בכרטיס כולל כעת אופציה אפורה "לא משויכות"
  בראש הפופאובר — מקבילה ידנית לגרירה לעמודת "לא משויכות"; לחיצה
  מבטלת את כל השיוכים בבת אחת.

### "שלח הודעה" — 2 אופציות
**אין שליחה דרך הבוט שלנו** (ראה §10).

```
שלח הודעה ←
  💬 WhatsApp (wa.me)   → פותח את WhatsApp האישי של המשתמש עם השיחה מוכנה
  📧 מייל                → mailto / Resend API
  🕐 תזמן שליחה         → [בקרוב] (כפתור אפור)
```

AI מכין נמען מוצע (אם זוהה בטקסט) + טקסט. המשתמש עורך + שולח.

### ארכיון
- כברירת מחדל — אודיו של מחשבות נמחק אחרי 60 יום (טקסט/משימות נשארים).
- כפתור שחזור ב-UI של כל מחשבה מארוכבת.
- גרירה ישירה לארכיון.
- ארכיון = באנר מקופל; פתיחה בלחיצה.

### אודיו = תשתית אחת עם recordings
מחשבה אודיו **לא** יוצרת אחסון כפול:
- שורה ב-`recordings` עם `source='thought'` — שם חיה שכבת האחסון/תמלול/דוברים.
- שורה ב-`thoughts` עם `recording_id` → מצביעה שם.
- AI extraction, retention, quota — הולכים דרך אותה צינורית.

### סכמה
```
thoughts
  id, organization_id, owner_id,
  source enum ('app_text'|'app_audio'|'whatsapp_text'|'whatsapp_audio'|'whatsapp_image'|'whatsapp_file'),
  text_content text,                 -- טקסט או תמלול
  ai_generated_title text,           -- Claude Haiku
  ai_summary text,
  recording_id nullable,
  tags text[],
  processed_at timestamptz,          -- null = לא מעובדת
  archived_at, archive_expires_at,
  created_at, updated_at

thought_lists
  id, organization_id, owner_id,    -- פר-משתמש (לא משותף)
  name, emoji, color, sort_order,
  created_at, updated_at

thought_list_assignments            -- many-to-many
  thought_id, list_id,
  sort_order_in_list,
  assigned_at,
  PRIMARY KEY (thought_id, list_id)

thought_processings                 -- כל "פירוק" של מחשבה לישות
  id, thought_id,
  target_type ('task'|'event'|'project'|'recording'|'message'),
  target_id uuid,
  ai_suggested boolean,
  created_at
```

**שקיפות:** דרך `thought_processings` רואים על כל מחשבה "זה הוליד: משימה א', אירוע ב'".

---

## 20. מסך פרויקטים / תמחור

מסך עבודה עשיר. **כל פרויקט = דשבורד של ווידג'טים נגררים** (ראה §12.1).

### זרימות תמחור
שני כיוונים, אותו מסך + אותה טבלה:

1. **מחיר סופי נתן הלקוח** → פרק למשימות → העריך שעות → הורד הוצאות → חלק בשעות → רואים תעריף שעתי אפקטיבי.
2. **אני מתמחר** → הגדר תעריף שעתי → משחקים עם פרמטרים → רואים מחיר סופי מוצע.

### Toggle פר-פרויקט: עם/בלי מע"מ
`projects.vat_percentage` — **פר פרויקט** (לא פר משתמש). לקוח חו"ל = 0%, לקוח ישראלי = 17%.

### ספייר (שעות התברברות)
- `spare_mode` = `'percent'` או `'hours'`.
- `spare_value` = הערך (למשל 15% או 8 שעות).
- `effective_hours = estimated + spare`.

### הוצאות נוספות
- רשימה **לא מוגבלת** של הוצאות: `label + amount_cents`.
- UI: שורה ריקה תמיד בתחתית (Enter → שורה חדשה).
- סכום מצטבר אוטומטי.
- טיפוסית 1-3 שורות.

### נוסחאות חישוב בזמן אמת (client-side)
```
estimated_total_hours = Σ(task.estimated_hours)
spare_hours_actual = spare_mode='percent'
    ? estimated_total_hours * (spare_value/100)
    : spare_value
effective_hours = estimated_total_hours + spare_hours_actual
expenses_total = Σ(project_expenses.amount_cents)

if pricing_mode = 'hourly':
    suggested_price = (effective_hours * hourly_rate * (1 + profit%/100)) + expenses_total
    with_vat = suggested_price * (1 + vat%/100)

if pricing_mode = 'fixed_price':
    available_for_labor = total_price - expenses_total
    effective_hourly_rate = available_for_labor / effective_hours
    profit_per_hour = effective_hourly_rate - cost_per_hour
```

### טבלת המשימות — UX מקסימלי
**קומפוננטה מרכזית במסך.** מבוססת TanStack Table + dnd-kit + zundo.

דרישות:
- **Enter בסוף משימה** → משימה חדשה מיידית.
- **תת-משימות** בכל עומק.
- **V** → צניחה לתחתית (רשימת אם / תתי אם).
- **עמודות** קבועות (דיפולט) + עמודות מותאמות אישית (הוספה/הסרה/שינוי שם).
- **גרירה** של שורות ושל עמודות.
- **Undo/Redo** מלא.
- **צירופים** פר משימה: הקלטה · מיקום · קישור · קובץ · תמונה · תגים · דירוג (כוכבים).
- **סטופר** בטבלה + בתוך ה-modal.
- **עריכה מלאה** — אותו modal כמו בכל מקום.
- **קיטלוג כאירוע** — `is_event=true` → מופיע גם ביומן.

### עמודות ברירת מחדל
- משימה · שעות · ספייר · דחיפות (כוכבים) · סטופר · בפועל · הערות · שאלות.

### עמודות מותאמות אישית
```
task_custom_fields
  project_id, field_key, field_label,
  field_type enum ('text'|'number'|'date'|'select'|'multiselect'|'stars'|'checkbox'|'url'|'file'),
  options jsonb,                -- לסוגי select
  sort_order, visible boolean
```

הערכים נשמרים ב-`tasks.custom_fields jsonb`.

### שאלות
**תצוגה פר-פרויקט בלבד** (החלטת משתמש — אין מסך גלובלי).

- כתיבה חופשית בצד בזמן עבודה.
- יכולות לחלץ אוטומטית מתמלול הקלטה.
- כל שאלה: טקסט · תגים · תשובה (nullable) · קישור למשימה.
- נענתה → קו חוצה + צניחה לתחתית.

```
questions
  id, organization_id, owner_id,
  project_id nullable, task_id nullable,
  text, answer text, tags text[],
  source_recording_id nullable,
  answered_at nullable,
  sort_order, created_at, updated_at
```

### יומן קטן של פרויקט (ווידג'ט)
- מציג רק משימות + אירועים של הפרויקט הזה.
- ויזואלית: **מקווקו = מתוכנן**, **מלא = בפועל** (מ-time_entries).
- רואים מיד חריגות.

### סטטיסטיקות בזמן אמת (ווידג'ט)
- שעות שנחסכו (מול התקציב).
- משימות הושלמו.
- % ביצוע.
- חריגות תקציב.
- רווח שעתי בפועל.

### סטופר
פר משימה (טבלה + modal) + היסטוריית סשנים עם עריכה ידנית. סטופר אחד גלובלי (§15).

### העלאת הקלטה לפרויקט
- Drag-drop MP3 על הווידג'ט.
- נרשם ב-`recordings` עם `source='meeting'` (ברירת מחדל).
- אפשר לשייך למשימה ספציפית.

### תבניות פרויקט
**פר-משתמש** (לא פר-ארגון — החלטת משתמש):
- כפתור "שמור כתבנית".
- שומר: משימות + תמחור + layout של הטבלה + פרמטרים.
- כפתור "שכפול מהיר" בצד.
- שמירת "מועדף" (כוכב).
```
project_templates
  id, owner_id, organization_id,
  name, is_favorite,
  template_data jsonb,            -- serialization מלא
  created_at, updated_at
```

### הצעות מחיר (PDF / מייל / WhatsApp / לינק)
**דחוי ל-post-MVP** (הצהרת משתמש). כפתור ב-UI עם "בקרוב".

### סכמה — פרויקטים
```
projects
  id, organization_id, owner_id,
  name, description, client_name,
  status enum ('active'|'completed'|'on_hold'|'archived'),
  pricing_mode enum ('fixed_price'|'hourly'|'quote'),
  total_price_cents, hourly_rate_cents,
  profit_percentage,
  spare_mode ('percent'|'hours'), spare_value,
  currency default 'ILS',
  vat_percentage default 17.0,
  tags text[],
  is_archived boolean default false,
  archived_at, archive_expires_at,
  created_at, updated_at
  -- trigger: יצירת projects → יצירת task_list אוטומטית (kind='project')
  -- trigger: archive projects → cascade לרשימה + למשימות

project_expenses
  id, project_id,
  label text, amount_cents int,
  sort_order, created_at
```

---

## 21. מסך הגדרות / פרופיל

מרכז לכל ההעדפות.

### סקציות
1. **פרופיל** — שם, תמונה, מייל.
2. **ארגון** — שם, לוגו, חברים (הזמנה / הסרה / שינוי תפקיד).
3. **סיסמת הצטרפות לארגון** — לצפייה / שינוי (רק owner).
4. **מנוי** — plan, storage usage, trial, upgrade (בקרוב).
5. **WhatsApp** — קישור מספר, קוד verify, ניתוק.
6. **יומן Google** — סטטוס סנכרון, פתיחת היומן, התנתקות.
7. **Meet** — scope approval (toggle, מוסבר מה זה).
8. **ברירות מחדל פרויקט** — תעריף שעתי, אחוז רווח, ספייר, מטבע.
9. **Retention** — ברירת מחדל פר סוג (thought/call/meeting).
10. **התראות** — מטריצה פר סוג × ערוץ (in_app/push/email).
11. **תצוגה** — theme, RTL (נעול), שפה.

### שדות ב-profiles להעדפות
```
profiles
  + show_vat_default boolean default true
  + default_hourly_rate_cents
  + default_profit_percentage
  + default_spare_mode, default_spare_value
  + default_retention_thought_days default 60
  + default_retention_call_days    -- null = לעולם
  + default_retention_meeting_days
```

---

## 22. מסך Admin (super admin)

ראה §7. מסך זה מופיע רק אם `is_super_admin=true`.

### ווידג'טים
- רשימת ארגונים (עם actions: ערוך, השעה, ארכב).
- רשימת משתמשים (עם actions: העבר ארגון, אפס סיסמה, התחזה, השעה).
- סטטיסטיקות מערכת — משתמשים פעילים, אחסון תפוס, עלויות AI, שימוש חודשי.
- Audit log — כל פעולה של כל super admin.

---

## 23. Landing אינטראקטיבי

מסך פתיחה לפני התחברות. לא רק "Login".

### מבנה
```
[Logo + Multitask]

Hero: "החלל לחשוב. החלל לעשות."

[דמו אינטראקטיבי שמתחיל אוטומטית:]
  1. עיגול דובר צומח מהמרכז.
  2. "שיחה עם דני על פרויקט" → מופיע כטקסט.
  3. טקסט מתפרק ל: משימה + אירוע + תגים.
  4. המשימה נוחתת ברשימה, האירוע ביומן.

"ככה Multitask עובד."

[🔵 התחבר עם Google]
אין חשבון? הירשם בכניסה הראשונה.

↓ (scroll לתכונות בפירוט)
↓ (פוטר: תקנון, פרטיות, יצירת קשר)
```

### טכנולוגיה
- React component נפרד ב-route `/welcome` (או `/` למשתמשים לא מחוברים).
- **Framer Motion** לאנימציות (או Lottie אם יש animation מעוצבת).
- Tagline מתחלף כל 4 שניות.

---

## 24. Onboarding

אחרי התחברות Google ראשונה של משתמש חדש (אין לו שורה ב-`organization_members`):

1. **מסך "ארגון"** — "צור חדש" / "הצטרף לקיים".
2. **טופס קצר** — שם + סיסמה.
3. **סיור קצר של 4 מסכים** — משימות, מחשבות, יומן, פרויקטים (tooltips אינטראקטיביים).
4. **דשבורד**.

### אופציונלי ב-onboarding
- קישור WhatsApp (אפשר לדחות).
- אישור scope של Meet (אפשר לדחות).

---

## 25. סכמת DB — סיכום טבלאות

| טבלה | תפקיד |
|------|------|
| `auth.users` | Supabase מנהלת |
| `profiles` | מטא-דאטה למשתמש, billing hooks, WhatsApp, Google mirror, preferences |
| `organizations` | ארגונים + billing hooks + `suggested_domain` + `join_password_hash` |
| `organization_members` | user ↔ organization (role) |
| `shares` | שיתוף פולימורפי פר פריט (entity_type + entity_id + user_id + permission) |
| `projects` | פרויקטים + תמחור + ארכיון |
| `project_expenses` | רשימת הוצאות לא מוגבלת פר פרויקט |
| `project_templates` | תבניות פר-משתמש |
| `task_lists` | רשימות משימות (kind=project/custom), ארכיון |
| `tasks` | משימות + תת-משימות + recurrence + scheduling + approval |
| `task_dependencies` | תלויות (4 סוגים) + lag_days |
| `task_attachments` | קבצים/הקלטות/מחשבות/לינקים לכל משימה |
| `task_custom_fields` | הגדרות עמודות מותאמות פר-פרויקט |
| `time_entries` | סשני סטופר |
| `questions` | שאלות פתוחות פר-פרויקט |
| `events` | אירועי יומן + Meet + google_event_ids |
| `event_participants` | משתתפים פנים-ארגוניים + RSVP |
| `recordings` | הקלטות, transcript, retention |
| `recording_speakers` | תיוג דוברים |
| `recording_tasks` | קישור הקלטה → משימה + assignment ל-speaker |
| `thoughts` | מחשבות (4 מקורות) |
| `thought_lists` | רשימות פר-משתמש |
| `thought_list_assignments` | many-to-many |
| `thought_processings` | כל פירוק של מחשבה לישות |
| `whatsapp_inbound_log` | לוג לדיבוג |
| `notifications` | התראות in-app |
| `push_tokens` | טוקנים של מכשירים ב-OneSignal |
| `user_notification_preferences` | העדפות פר סוג × ערוץ |
| `user_dashboard_layouts` | layouts נגררים (פר-משתמש × מסך × scope) |
| `user_list_visibility` | נראות רשימות (פר-משתמש × מסך) |
| `user_saved_filters` | פילטרים שמורים |
| `super_admin_audit_log` | רישום פעולות admin |

### עקרונות RLS
- **כל טבלה עם `organization_id`** מקבלת policy ראשי לפי §5.
- פריטים עם `owner_id` + policy משני דרך `shares`.
- טבלאות user-scoped (`user_dashboard_layouts`, `user_saved_filters`, וכו') → `user_id = auth.uid()`.
- Super admin RPCs עם `SECURITY DEFINER`.

### Realtime
מופעל על: `tasks`, `projects`, `events`, `recordings`, `thoughts`, `notifications`, `time_entries`.
לא על: audit logs, inbound logs, layouts (שמירה מקומית מספיקה).

---

## 26. אינטגרציה — צ'קליסט הכנה חיצונית

לא חוסם את הבנייה (יש adapter stubs). להצבה בסביבה:

1. **Google Workspace Business Starter** ($6/חודש) — חשבון חדש + דומיין.
2. **Service account** ב-Google Cloud עם הרשאות Calendar + Meet API.
3. **Meta Business + WhatsApp** — מספר ייעודי + verification (1-3 ימים).
4. **OneSignal** — פרויקט + iOS/Android apps בחנויות.
5. **Gladia** — API key.
6. **Anthropic** — API key (Claude Haiku).
7. **Supabase** — פרויקט + DB + Storage bucket `recordings`.
8. **Super admin email** — המייל של הבעלים, נשתל ידנית ב-`profiles.is_super_admin=true`.

---

## 27. מה נדחה במפורש (שלא יצוץ בעתיד כהצעה חדשה)

| פיצ'ר | סיבה | מתי לחזור |
|-------|------|----------|
| אימייל+סיסמה ביתית | מוריד אבטחה, מוסיף שטח תקיפה | לא |
| סנכרון Google Calendar דו-כיווני | 3-4 שבועות בנייה + edge cases | אם משתמש מתעקש |
| הזמנת משתמשים חיצוניים לאירועים | דורש OAuth scope רגיש | post-MVP, כ"שתף לינק ציבורי" |
| שליחת WhatsApp דרך הבוט שלנו | Meta מגביל הודעות חופשיות | עם תבניות מאושרות, post-MVP |
| תזמון שליחת הודעה מראש | תלוי בקודם | post-MVP |
| הצעת מחיר PDF/email/WhatsApp/link | נדחה על-ידי משתמש | post-MVP |
| Stripe/Paddle integration | נדחה במכוון | כשיש מחיר חודשי סגור |
| Paywalls לפי plan | תלוי ב-billing | ביחד עם billing |
| ייבוא אירועים מהיומן האישי של Google | לא נדרש | אם משתמש יבקש |
| תצוגת Kanban / Timeline למשימות | המשתמש הבהיר שרצה רשימות בלבד | לא |
| טבלת משימות במסך משימות | המשתמש הבהיר — זה לא טבלה | לא |
| חיפוש גלובלי של שאלות | רק פר-פרויקט | לא |

---

## 28. החלטות ארכיטקטוניות קריטיות (אזהרת בנייה)

1. **כל ישות חיה בטבלה אחת** — tasks מ-recording, thought, project, יד — כולן באותה טבלה `tasks`. אין כפילויות.
2. **אף מסך לא שולף ישירות מ-DB** — הכל דרך services + React Query hooks. query keys משותפים לכל המסכים.
3. **Realtime ↔ React Query sync** — אסטרטגיה: על event מ-Realtime → `queryClient.invalidateQueries([key])`. עבור updates קלים (סטטוס/כותרת) → `setQueryData` לעדכון מיידי. לעולם לא להסתמך רק על Realtime — cache מוביל.
4. **Optimistic updates בכל mutation** — UX חייב להיות מיידי. rollback על שגיאה.
5. **RTL בכל מקום** — אף טבלה / ווידג'ט / רכיב לא נבנה בלי בדיקת RTL.
6. **Design tokens בלבד** — אין hardcoded colors / spacing / shadows. הכל מ-`design-language.html`.
7. **Adapter pattern לאינטגרציות** — Gladia / Google / WhatsApp / OneSignal / Cloudflare R2 כולם מאחורי interface. החלפה = יום.
8. **אין מחיקה של tasks/recordings/projects** — רק ארכיון 60 יום → מחיקה אוטומטית ב-cron.
9. **סודות שירותים חיצוניים אף פעם לא בדפדפן.** כל env var עם prefix
   `VITE_*` מוטמע ב-bundle ונחשף לכל מבקר ב-DevTools. לכן: `R2_SECRET`,
   `ANTHROPIC_API_KEY`, `GLADIA_API_KEY`, `RESEND_API_KEY` וכל
   credentials של ספקים — **בלי `VITE_` prefix**, חיים אך ורק
   ב-Supabase Edge Functions / Supabase secrets. הדפדפן מקבל
   presigned URLs קצרי-טווח או JWTs חד-פעמיים, ולעולם לא את הסוד עצמו.
   שכבת ה-`StorageProvider` / `TranscriptionProvider` בקוד client היא
   thin client לקוראת ל-Edge Functions, לא ה-SDK עצמו.

---

## Changelog

- **2026-04-23** — גרסה 1.0. תיעוד מלא של שיחת האפיון.
- **2026-04-23** — פאזה 3 הסתיימה: מסך משימות (§15).
  - עמודות של רשימות + גלילה אופקית, "לא משויכות" מקובעת ב-`sticky start-0` (RTL).
  - עץ היררכי לפי `parent_task_id` בעומק לא מוגבל; בנייה+מיון במקום אחד
    (`buildTrees` ב-`Tasks.tsx`): משימות הושלמו צונחות לתחתית הסקופ —
    גם ברמת רשימה וגם ברמת תתי-המשימות של ההורה.
  - Enter בסוף שורה = שמירה + משימה חדשה אח עם focus; `Tab` / `Shift+Tab` =
    קידום/הורדת רמה ביחס לאח הקודם / הורה.
  - סטופר inline, כוכבי דחיפות inline, תפריט שורה (עריכה / שכפול תת-עץ).
  - `@dnd-kit`: drop על עמודה מעביר `task_list_id`, drop על משימה
    הופך אותה ל-child. חסום drop על עצמי או על צאצא.
  - `ListsBanner` / `FilterBar` / `useFiltersFromUrl` משובצים מהתשתית הקיימת.
  - `TaskEditModal` נפתח מ-double-click או מהתפריט.
  - אין מחיקה של משימה בודדת — רק ארכוב ברמת רשימה (SPEC §28).
  - החלטות שלא היו מפורשות ב-SPEC המקורי:
    - "לא משויכות" ממוקמת בצד הלידינג (ימין ב-RTL) — פריט DOM ראשון +
      `sticky start-0` — כי זה הצד שאליו העין של המשתמש נכנסת ראשונה ב-RTL.
    - משימה עם `parent_task_id` שמצביע למשימה שלא נמצאת בסליס של הרשימה
      הנוכחית (נדיר; קורה אם הורה עבר לרשימה אחרת) מטופלת כשורש באותה
      רשימה במקום להיעלם. גרירה בין רשימות לא מבצעת cascade לצאצאים
      (החלטה לצמצום מורכבות MVP — אותה פילוסופיה של §15 "משימה ברשימה אחת").

- **2026-04-23 — פאזה 3 הושלמה: איטרציית UX מלאה של מסך המשימות.**
  בסשן הבא ממשיכים למסך הבא (§16 יומן). ריכוז מה שנכנס מעל הבסיס של
  פאזה 3:

  **רכיבים חדשים ב-UI:**
  - `<DateTimePicker>` (portal ל-body) — לוח שנה עם היום בצהוב; השעה
    עברה מעמודות-גלילה ל-`<input type="time">` נייטיבי (OS picker).
  - `<DurationInput>` עם מסכה HH:MM ל"משך" ו"הערכת שעות".
  - `<UrgencyChip>` — 3 קווים אופקיים מוערמים, ערך 0-3 (migration 0003
    הרחיב את ה-CHECK constraint מ-1-5 ל-0-5). הוחלף הכוכב הקודם.
  - `<TaskDependenciesSection>` — MSProject-סטייל, 4 סוגי קשר
    (FS/SS/FF/SF) + lag days + חיפוש משימות. מעגליות נחסמת ע"י
    `check_no_dependency_cycle` trigger קיים.
  - `<ShareListModal>` — שיתוף רשימה ל-org members דרך טבלת `shares`
    (entity_type='task_list'). קריאה / כתיבה פר-משתמש.
  - `<ArchiveModal>` + `<RowDisplaySettingsModal>` + `<StatusesModal>`
    — כולם נגישים מגלגל "הגדרות הדף" שבראש המסך.
  - `<StatsPanel>` — טבלה אופקית מעל ה-FilterBar (שם / התקדמות /
    פתוחות / הושלמו / בפועל / הוקצה / פער ירוק-אדום).
  - `<AnimatedFab>` — FAB חדש בכל breakpoint, מחליף אייקון+גרדיאנט
    כל 2.6s בפלטת מותג בלבד (צהוב / אמבר / ורוד / כתום).
  - `<UnassignedBanner>` — נפרד מ-TaskColumn; במובייל נפתח/נסגר כלפי
    מעלה (פס דק), בדסקטופ כרצועה אנכית בצד הלידינג.

  **שינויי סכמה (מיגרציות 0001-0004):**
  - `user_task_statuses` פר-משתמש (key / label / color / kind / sort_order /
    is_builtin). `tasks.status` הומר מ-enum ל-text (אין יותר מגבלה של
    5 ערכים). 5 ברירות-המחדל נזרעות אוטומטית ב-trigger על `profiles`.
  - `task_lists.is_pinned` — נעיצה של רשימה מהתפריט.
  - RLS של `task_lists` + `tasks` הוחלפה מ"org-wide read/write" ל-
    "owner + explicit shares". כלומר רשימה חדשה פרטית ליוצר עד שיתוף
    מפורש.
  - `urgency between 0 and 5` (במקום 1..5) כדי לאפשר מצב "ללא דירוג".
  - RPC `reset_user_task_statuses()` לאיפוס פלטת הסטטוסים לברירת מחדל.

  **מבנה כללי של Tasks.tsx:**
  - פריסה אחראית בפונקציית `divisor = min(visibleCount, maxVisible)` —
    כל עמודה תופסת `calc(100% / divisor)`. רשימה אחת = מסך מלא, שתיים
    = חצי כל אחת, וכו'. מעל המקסימום — גלילה אופקית באזור הראשי בלבד
    (לא מזיז את "לא משויכות").
  - במובייל: ערימה אנכית, "לא משויכות" למעלה.
  - FilterBar — אינליין עם grid 1/2/3 עמודות, מכווץ כברירת מחדל,
    chips כשסגור, כפתור "סינון" לפתיחה/סגירה.
  - StatsPanel — מכווץ כברירת מחדל; נפתח בלחיצה.
  - ListsBanner — chips של רשימות + יצירה inline. Max-visible stepper
    עבר לגלגל "הגדרות הדף" (איחוד עם שאר ההגדרות המסכיות).
  - ⋯ על ראש רשימה: שנה צבע (underline של הכותרת ב-24 swatches) /
    נעיצה / שנה שם / שנה אייקון (20 lucide icons מקווצים — לא emoji) /
    שיתוף וסנכרון / ארכב (באדום עם אישור). צבע ברירת מחדל אפור אם
    המשתמש לא בחר — אי אפשר יותר "בלי צבע".
  - ⋯ על שורת משימה: **בדסקטופ** — שכפל משימה / שכפל עץ / שכפל
    לרשימה אחרת / מחק (באדום, cascade לצאצאים, דורש אישור, מחליף
    החלטת SPEC §28 "אין מחיקה"). **במובייל** — אותו תפריט + prelude
    עם כל ה-badges האינליין כשורות אינטראקטיביות (דחיפות / סטטוס /
    סטופר / תאריך יעד / קישור / ...) כדי לשמור על שורת משימה נקייה.

  **שורת משימה (דסקטופ):**
  - Badges שנשלטים ב-`useRowDisplayPrefs` (localStorage, 10 שדות).
    ברירת מחדל: urgency + subtasks + timer דלוקים, השאר כבויים.
  - חוץ מהעיפרון / תת-משימה / ⋯ מחוץ לשורה, כל השאר מופיע ב-hover.
  - צביעה של המשימות לפי `--list-color` CSS var של העמודה (check ו-
    stars לוקחים את צבע הרשימה).

  **TaskEditModal:**
  - 4 טאבים: פרטים / תזמון / זמן / צירופים.
  - פרטים: סטטוס (StatusPicker עם עריכה inline של label + צבע +
    הוספת סטטוס חדש ישירות מהחלון) · רשימה · דחיפות (3-קווים) ·
    אחראי (org members) · תיאור · תגים · הערות · מיקום · URL.
  - תזמון: DateTimePicker + DurationInputs + TaskDependenciesSection.
  - זמן: TimeEntriesTab עם UnitSwitch (אוטו / דקות / שעות / ימים —
    useTimeUnit משותף עם הלייבל בשורה).
  - צירופים: scaffolding ויזואלי בלבד (wiring מגיע עם הקלטות/מחשבות).
  - "משימה חדשה" מ-QuickCapture → יוצרת משימה ריקה ומנווטת ל-
    `?edit=<id>` כדי לפתוח מיידית את המודל ולבחור בו רשימה.

  **Undo/Redo גלובלי (SPEC §12.4):**
  - Zustand store (past/future stacks), Ctrl/Cmd+Z / Ctrl/Cmd+Y /
    Ctrl/Cmd+Shift+Z. עוקף שדות input כדי לא לרוץ על הדפדפן.
  - כפתורי Undo / Redo ב-topbar (disabled כשאין מה לעשות).
  - מכוסה: סימון השלמה, דחיפות, Tab/Shift+Tab, גרירה בין רשימות,
    גרירה לתת-משימה, שם רשימה, emoji/אייקון של רשימה, צבע רשימה,
    נעיצה, הוספת/שינוי/מחיקת סטטוס, שינוי אחראי, הוספת/מחיקת תלות.

  **החלטות שנוספו או שונו מ-SPEC:**
  - מחיקת משימה — *מאופשרת* בניגוד ל-§28 (hard delete + cascade,
    עם אישור). המשתמשת ביקשה זאת במפורש.
  - הסטטוסים פרטיים פר-משתמש (לא משותפים לארגון) — לפי בקשת המשתמשת.
    ה-RLS עדיין מאפשר קריאה פנים-ארגונית של הפלטה כדי שמשימות משותפות
    יציגו את הלייבל/צבע של הבעלים.
  - בעת שיתוף/שינוי רשימה — RLS זוהה כפגום (org-wide) ותוקן ל-
    owner+shared-explicit. זה שינוי פרטיות משמעותי ביחס לסכמה
    ההתחלתית.
  - "ללא צבע לרשימה" — הוסר. רשימה תמיד עם צבע (אפור עדין ברירת מחדל).
  - היררכיית דירוג דחיפות ירדה מ-5 ל-3 (המספרים 4-5 הישנים נחתכים
    לתצוגה ל-3 אבל נשמרים ב-DB).

  **אינטגרציות ותיקוני build:**
  - Supabase MCP הורץ ישירות מהסשן — `apply_migration` על פרודקשן
    לארבע מיגרציות חדשות (user_task_statuses, private_task_lists,
    allow_urgency_zero, reset_user_task_statuses_rpc).
  - תוקנו שתי קריסות runtime: Zustand v5 selector שחזר אובייקט חדש
    בכל render (גרם ל-"getSnapshot should be cached"), ו-side-effect
    בתוך useMemo שהועבר ל-useEffect.
  - תשתית build שנשברה מלפני הסשן (react-grid-layout typing, Json
    casts, unused imports) תוקנה כדי ש-Vercel יצליח לפרוס.
  - ענפי ה-waves ב-main הוחלפו ב-SPEC track דרך force-push מ-
    HC7D4 → main, עם `archive/waves-main` כגיבוי.

  **הפאזה הבאה (לסשן הבא):** §16 — מסך יומן.

- **2026-04-24** — פאזה 4 הסתיימה: מסך יומן (§16) + מסך Gantt (§17).
  - **יומן** — יום/שבוע/חודש כ-custom component (CSS grid + absolute-positioned
    blocks). אלגוריתם column-packing לחפיפות, קו "עכשיו" אדום, highlight של
    היום הנוכחי בשבוע.
  - מקווקו = משימות מתוזמנות (dashed border); מלא = אירועים (solid).
    פסי זמן בפועל (`time_entries`) מצוירים כ-stripes ירוקים בצד inline-start
    של כל רצועת שעה — רואים חריגה מול התכנון ברגע אחד.
  - `TasksEventsToggle` (both/tasks/events) יושב ב-`ListsBanner.extra`.
  - יצירת אירוע: קליק על רצועת זמן פנויה פותח `EventEditModal` עם שעת
    ברירת מחדל; עריכת משימה פותחת את `TaskEditModal` המשותף.
  - סינון: `useFiltersFromUrl` עם lists/tags/onlyMine; טאסקים עוברים גם
    דרך `scheduledAfter/Before` כדי לצמצם תעבורת דאטה לטווח הנראה.
  - **Gantt** — custom timeline (SVG arrows + CSS grid) ב-4 רמות זום
    (יום/שבוע/חודש/רבעון). שורות משימות עם indent של `parent_task_id`,
    בלוק = `scheduled_at → +duration_minutes` (fallback: `estimated_hours`).
  - גרירה אופקית של בלוק = `updateTask({ scheduled_at })`; גרירת קצה =
    `updateTask({ duration_minutes })`. Snap מותאם רזולוציה (15 דקות בזום יום,
    עד יום שלם בזום רבעון). pointer events raw, לא `@dnd-kit`, כי הציר רציף.
  - חיצי תלויות: SVG paths עם marker, כל 4 סוגי relation (בחירת endpoint
    לפי `relation`). flip קואורדינטות X ל-RTL (SVG לא יורש `dir="rtl"`).
  - **Critical path** — seed מהמשימות שסוף שלהן = סוף הפרויקט, הילוך לאחור
    על `finish_to_start` reverse-edges ומסומן כ-critical כל מי שה-slack
    שלו (פער הזמן בין סוף הקודם לתחילת הבא) קטן/שווה לשעה. Critical bars
    מצוירים בגרדיאנט danger→primary, רקע שורה מוצל, חיצים אדומים רציפים.
    Toggle "Critical path בלבד" מסנן ל-UI.
  - שכבת דאטה — שני hooks חדשים נוספו לתשתית:
    - `useTimeEntriesByRange({from,to})` + שאילתת org-wide עם `allTimeEntriesRange`
      realtime family (ליומן).
    - `useAllTaskDependencies()` + `listAllTaskDependencies` (ל-Gantt).
      Realtime על `task_dependencies` משבטל את המשפחה.
  - החלטות שלא היו מפורשות ב-SPEC המקורי:
    - **קריטי = slack ≤ 1 שעה** — סף tolerance כדי שהיסטי קטן בגלל
      רזולוציית `duration_minutes` לא ישבור את חישוב ה-critical path.
    - **Gantt fallback timing**: משימה עם `estimated_hours` בלבד (בלי
      `scheduled_at`) מוצגת החל מ"היום" במקום להישמט. משימות בלי אחד מהשניים
      לא מוצגות כלל — הן "עדיין לא בתמונה" של ציר הזמן.
    - **יומן — שבוע מתחיל ביום א'** (המוסכמה הישראלית), לא יום ב' (ISO).
    - **יומן בתצוגה חודשית** — כל פריט מוצג פעם אחת (ביום ה-start). אירוע
      רב-יומי לא מתפרס על כל הימים ב-MVP הזה; ה-view הזה הוא "תצוגה מהירה"
      ולא מקור אמת. שבוע/יום כן מחתכים נכון.
    - **פעולות יצירת Meet / סנכרון Google**: placeholder ב-modal ("בקרוב"),
      הסנכרון עצמו עובר לפאזה 9b לפי §9 של ה-SPEC.
  - **חוב טכני מול פאזה 3 wrap-up** (להאחדה בפאזת ליטוש עתידית):
    - הטולברים ב-Calendar/Gantt לא עברו דרך "גלגל הגדרות הדף" שנכנס
      ל-Tasks — הם יושבים בראש המסך כפאנל גלוי תמיד, כי שתי ההגדרות
      (view, zoom) הן מדרגת-שינוי-תכופה ולא preferences.

- **2026-04-24 (ערב)** — פאזה 4.1: שיפוץ יומן לפי משוב משתמש.
  **הערה:** החלטות הוויזואליזציה בסעיף 16 של ה-SPEC עצמו עברו שינוי.
  הגרסה הסמכותית כעת היא מה שמתואר כאן.

  **שפת ויזואליזציה חדשה** (מחליפה את §16 "מקווקו = מתוכנן / מלא = בפועל"):
  - **אירוע** — בלוק מלא בצבע הרשימה/מותג. אירוע שעבר מקבל אטימות 55%.
  - **משימה** — קו מתאר בלבד בצבע הרשימה; בפנים ריק (לא מקווקו).
  - **משימה שהושלמה** — קו אלכסוני חוצה את הבלוק + line-through על
    הכותרת, אטימות 55%.
  - **משימה באיחור** (זמן סיום עבר ולא הושלמה) — מתאר אדום + מילוי
    אדום-בהיר (rgba 0.10).
  - **ימים שעברו** (בשבוע/חודש/אג׳נדה) — tint עדין של `ink-100/30` על
    התא כולו.
  - **חלק היום שעבר** (day/week, רק עבור today) — overlay של `ink-900/3.5%`
    מתחילת הטווח המוצג ועד קו ה"עכשיו".
  - **בפועל (`time_entries`) — בלוק חופף במקום פס צד:** מוצג כרצועה
    מלאה בתוך הבלוק המתוכנן, באותה עמודה, ב-y-range של הדקות שעבדו
    בפועל. "מתאר = מתוכנן, המילוי = מה שעשית".

  **טווח שעות ניתן להגדרה** (`useCalendarPrefs` + `HourRangeSettings`):
  - ברירת מחדל 7:00-22:00 (חלון עבודה טיפוסי).
  - כפתור "24h" בטולבר = override מיידי, חוזר לברירת המחדל בלחיצה שנייה.
  - גלגל הגדרות פותח popover לבחירת start/end ברירת המחדל פר משתמש
    (localStorage — לא מסונכרן בין מכשירים ב-MVP; ניתן להעביר ל-
    `user_dashboard_layouts.widget_state` בלי שינוי סכמה).

  **תצוגת אג׳נדה** (`CalendarAgendaView`):
  - נבחרת אוטומטית במסכים ≤ 768px (במקום שבוע 7-עמודות שלא שמיש במובייל).
  - חלון 14 יום מיום א' של השבוע העוגן.
  - כל יום עם כותרת sticky גדולה (גבול + תאריך בעברית + ספירת פריטים
    + "+ אירוע"). הפרדת יום ברורה בלי אפשרות לבלבל.
  - משתמש יכול לעבור ידנית חזרה ל-day/month; שבוע מוסתר במובייל.
  - Toolbar מקבל `availableViews` ו-`showHourSettings`, וה-label של
    התאריך משתמש ב-flex-1 כדי לא להידחף לפינה.

  **חזרה (RRULE)** — `RrulePicker` חדש:
  - FREQ: DAILY / WEEKLY / MONTHLY / YEARLY + INTERVAL + BYDAY
    (לשבועי) + UNTIL אופציונלי. Round-trip ל-RFC 5545.
  - מתחבר ל-`events.recurrence_rule` הקיים; אותו רכיב יוכל לשמש את
    משימות (`tasks.recurrence_rule`) בפאזת ליטוש עתידית.

  **מוזמנים + RSVP** — `EventParticipantsSection`:
  - Autocomplete מתוך `useOrgMembers` (רק חברי ארגון, בלי email חיצוני לפי §9).
  - כל משתתף עם שם/email + אווטאר אותיות + סטטוס RSVP בצבע.
  - המשתתף הנוכחי יכול לשנות RSVP משלו (accepted / tentative / declined)
    דרך switcher inline.
  - המארגן מסומן "(מארגן)" ולא ניתן להסיר אותו; אחרים — כן.

  **EventEditModal משופץ** — 3 טאבים:
  - פרטים / מוזמנים / חזרה.
  - משתמש ב-`<DateTimePicker>` של Tasks (פאזה 3) — תחושה אחידה לצוות.
  - `all-day` משנה את ה-picker ל-dateOnly.
  - הזזת שעת ההתחלה שומרת על אותה משך (end zsugh יחד עם start).
  - כפתור "🎥 צור Meet" disabled עם tooltip "בקרוב — פאזה 9b".

  **CalendarStatsStrip** — רצועת סטטיסטיקות שבועית מעל היומן:
  שעות עבודה השבוע · אירועים השבוע · משימות הושלמו · משימות באיחור.
  **הערה:** פאזה 4.1 **לא** הכניסה DashboardGrid מלא ליומן
  (SPEC §12.1). הסיבה: היומן הוא ווידג'ט אחד דומיננטי (גריד שעות של
  ~720px גובה), וה-layout הגרירני של react-grid-layout לא מוסיף ערך
  כשיש ווידג'ט ראשי כל-כך גדול. להרחיב כשיהיה לנו gallery של widgets
  מעניינים ליומן (upcoming, מעבר ארגוני, סטטיסטיקות פר-לקוח וכו').

  **חוב טכני פתוח:**
  - **Unified TaskEditModal עם tab "אירוע"** (§16) — נדחה. TaskEditModal
    בפאזה 3 תפח ל-1180 שורות עם DI משלו (DateTimePicker, DurationInput,
    UrgencyChip, TaskDependenciesSection); שילוב event בתוכו דורש
    refactor אמיתי. EventEditModal משתמש כעת באותם primitives כדי
    שהתחושה תרגיש אחידה עד אז.
  - **סנכרון Google Calendar** — placeholder בלבד, פאזה 9b לפי §9.

- **2026-04-24** — פאזה 5: שלבים (Phases).
  - מיגרציה חדשה `20260424000001_task_phases.sql`: שדה
    `tasks.is_phase boolean default false` + trigger שאוסר:
    (א) שלב כילד של משימה אחרת, (ב) שלב בתוך שלב.
  - `TaskEditModal` — toggle "הגדר כשלב" במסך פרטים, זמין רק למשימות
    ברמת-הרשימה (`parent_task_id IS NULL`).
  - `TaskRow` — שורת שלב עם border צבעוני בצד הלידינג + רקע tint + תג
    "שלב" + font bold.
  - `GanttBar` — שלב מצויר כבלוק בגוון מתוך פלטת צבעי הרשימה, עם
    hybrid "planned + overage": אם הילדים חורגים מהסיום המתוכנן,
    יש הארכה מקוקווה-אדומה עד `max(children.end)`. שלבים לא משתתפים
    ב-Critical Path.
  - `Calendar` (שבוע/חודש) — שלב נחשב תמיד multi-day ונצבע כ-band
    בצבע ה-shade, עם טקסט "שלב · שם".
  - `src/lib/utils/color-shades.ts` חדש — `generateShades` +
    `pickShade(phaseId, palette)` עם hash יציב לבחירת shade לשלב.
  - SPEC §15.11 חדש ("שלבים") מתעד את המודל, הוויזואל וההחלטות.
  - הבחירה: **Option C** (planned + overage hybrid) — נבחרה במפורש
    ע"י המשתמש כי היא מראה "תכנון מול מציאות" במבט אחד.
  - ⚠ **מיגרציה `20260424000001_task_phases.sql` הוחלה על ה-DB
    ב-2026-04-24 בסשן פאזה 5** (דרך Supabase Dashboard → SQL Editor).
    העמודה `tasks.is_phase` + הטריגר חיים. הכפתור "הגדר כשלב"
    עובד.

- **2026-04-24 (סוף יום)** — פאזה 4 פוסט-מורטם / polish batch.
  סיכום כל העבודה בין ה-MVP של פאזה 4 (PR #9) לבין פאזה 5:

  **תשתית chrome אחידה (§12.8 חדש):**
  - `CalendarChrome`, `TasksChrome`, `GanttChrome` — באנר עליון דק
    אחד פר מסך עם כפתורים אייקוניים (popover / toggle). ברירת מחדל:
    הכל סגור. כפתור → פאנל מתחת או popover מוצמד.
  - Popovers עם `createPortal` + `position: fixed` + viewport-clamp,
    ו-close ב-Esc / outside-click. פתרון יציב לבעיית "popover נחתך
    בקצוות" שחזרה כמה פעמים.
  - `layout/ChromeControls.tsx` משתף את `ToggleButton` + `PopoverButton`
    בין 3 המסכים (חוק שלושת הפעמים).

  **יומן (פוסט-פאזה 4.1):**
  - Multi-day band עובר גם לתצוגת חודש (bar משתרע אופקית על ימי-שלב,
    שבועות, עם packing לשורות ללא חפיפה).
  - Agenda עבר עיצוב מחדש — כרטיס רציף אחד עם צ׳יפ תאריך גדול
    (צבעוני להיום) מהימין כמפריד-ימים חד-משמעי.
  - `isMultiDay(item)` מחזיר true גם לשלבים (מתמיד רינדור באנר למעלה).
  - Event spanning two days: שירבוט אופקי רצוף בראש העמודות במקום
    שני בלוקים של 24h בצדדים.
  - TaskEditModal נפתח על טאב "תזמון" כשפותחים מהיומן/Gantt.
  - `הערכת שעות` עברה מטאב "תזמון" לטאב "זמן" (ליד הסטופר) לפי
    בקשת המשתמש — אותה שכבת-מחשבה.
  - `CalendarStatsStrip` קטן: שעות עבודה השבוע · אירועים · הושלמו ·
    באיחור — toggleable בבאנר.

  **משימות:**
  - `TasksChrome` מחליף ListsBanner + WorkbenchBanner — הכל בכרטיס
    דק אחד. רשימות popover עם צ׳קבוקסים + "+ רשימה חדשה".
  - `PlanVsActualBar` (רכיב משותף) — חיווי ויזואלי של שעות מתוכננות
    מול שעות שנעשו בפועל. בטאב "זמן" של TaskEditModal ובטור המשימות
    האינליין. מילוי גרדיאנט עד 100%, דימום אדום אחרי זה.

  **Gantt:**
  - `GanttChrome` — כפתורי popover ו-toggle: ניווט תאריך, זום (שבוע/
    חודש/רבעון — יום הוסר), layer (משימות/אירועים/שניהם), רשימות,
    סינון, critical-only, collapse-sidebar.
  - אירועים כשורות ב-Gantt (לא רק משימות); drag → עדכון
    `starts_at/ends_at`. קליק על אירוע פותח `EventEditModal`; קליק
    על משימה פותח `TaskEditModal`.
  - `GanttRow` widened ל-discriminated union (task | event) עם
    `isPhase`, `phaseId`, `childrenEnd`, `accentColor`.
  - Hover info card מעל כל בר עם title + טווח + badges + כפתור
    עיפרון-עריכה.
  - סף drag 4px — קליק נקי פותח את המודל, לא נבלע ע"י mis-detection.
  - Collapsible task-name sidebar (רצועה של 24px במצב מזער).

  **תיקוני באגים יסודיים:**
  - `useCalendarPrefs` (24h toggle): היה מחזיר object חדש בכל
    `getSnapshot` → `useSyncExternalStore` חשב שזה שינוי →
    infinite loop. תוקן עם `cachedSnapshot` מודולרי.
  - זמני סטופר ידניים: הטריגר ב-DB מנסה לחשב `duration_seconds`
    ב-AFTER-INSERT (שם Postgres זורק מודיפיקציות ל-NEW). תוקן
    בצד-לקוח ב-`createManualEntry` / `updateTimeEntry` שמחשבים ומעבירים
    `duration_seconds` במפורש.
  - TaskDependenciesSection: נוסף עיפרון-עריכה + שינוי relation/lag
    על-תלויות קיימות (service + hook `updateTaskDependency`).
  - מסך חודשי: באנרים רב-יומיים לא התנגשו עם מספרי הימים (restructure
    להצמיד band overlay מעל התאים עם padding דינמי).
  - Gantt critical-path label/icon: "Target/מטרה" הוחלף ל-"נתיב
    קריטי" עם Flame icon.
  - Filter options: הוסרו slugs של אייקונים (`icon:chart`) מהתוויות —
    שם הרשימה בלבד.

  **SPEC updates:**
  - §12.8 "Screen Chrome" — עקרון מובייל-ראשית לכל המסכים הבאים.
  - §15.11 "שלבים" — מודל + ויזואל + Option C.
  - §16 התראה על השינוי בשפת-הוויזואליזציה (אירוע מלא / משימה
    מתאר / זמן-בפועל כ-overlay חופף — מחליפה את "מקווקו/מלא"
    המקורי).

  **מה נותר פתוח לפאזה הבאה:**
  - החלת מיגרציית השלבים על ה-DB (user action).
  - RRULE expansion אמיתית ב-UI (אירוע חוזר עדיין מופיע כפעם אחת).
  - Timezone picker מוגדר פר-משתמש.
  - `TaskEditModal` ו-`EventEditModal` להאחד כ-"EntityEditModal"
    משותף (קיים ב-SPEC §16 — עדיין לא). שניהם כבר משתמשים באותו
    `<DateTimePicker>`.
  - DashboardGrid מלא ליומן/Gantt (CalendarStatsStrip הוא stand-in).
  - Sync ליומן Google (פאזה 9b לפי §9).

- **2026-04-24** — פאזה 5 הסתיימה: מסך מחשבות (§19) +
  סגירת 2 מ-3 חובות טכניים פתוחים (RRULE, timezone).

  **מסך מחשבות (§19):**
  - `ThoughtsChrome` — חמישה כפתורי chrome לפי §12.8 (רשימות popover,
    סטטיסטיקות toggle, סינון toggle, תצוגה popover, ארכיון toggle).
    מובייל = אייקונים בלבד, דסקטופ = אייקון + טקסט. הכל סגור
    כברירת מחדל; העדפות (view / sort / density) נשמרות ב-
    `localStorage` תחת `multitask:thoughts:{view,sort,density}`.
  - `ThoughtComposer` — textarea שמתמקד אוטומטית בראש המסך. Enter
    שומר (אופטימיסטית), Shift+Enter = שורה חדשה. focus חוזר
    אוטומטית אחרי שמירה כך שהמשתמש ממשיך להקליד.
  - `ThoughtCard` — כרטיס פר מחשבה: chips של רשימות (עם × לביטול
    שיוך), source + timestamp יחסי, כותרת-AI, טקסט עד 3 שורות,
    ושלושה כפתורי פעולה: "📎 לרשימה" (popover), "⚡ עבד" (פותח
    את באנר ה-AI inline כ-accordion), "✓ סמן" (processed_at).
    כרטיס משויך לריבוי רשימות מקבל `ring-1` עדין; ליחידה — border
    בצבע הרשימה בצד הלידינג.
  - `ThoughtAiBanner` — accordion בתוך הכרטיס. **שרשור הצעות**
    פועל: כל לחיצה משאירה את שאר ההצעות פעילות; ההצעה שבוצעה
    מסומנת ✓ + לינק "פתח" לישות שנוצרה. שבעה כפתורי פעולה
    קבועים + הצעות דינמיות מ-`mockProvider`. סגירת הבאנר פותחת
    תפריט "סמן כמעובדת / לארכיון / השאר פתוחה".
  - `SendMessagePopover` — פנל inline בתוך הבאנר, לא modal. wa.me +
    mailto (§10: בלי בוט משלנו). "תזמן שליחה" disabled עם tooltip
    "בקרוב".
  - `ThoughtEditModal` — 3 טאבים (פרטים / מקור / נוצרו מזה). הטאב
    "נוצרו מזה" קורא `thought_processings` ומאפשר לקפוץ ישירות
    למודל של המשימה/אירוע/פרויקט שנוצרו.
  - "מקור" ב-`TaskEditModal` ו-`EventEditModal` — כל אחד מהם מציג
    כרטיסון עם "← נוצר מהמחשבה" כשיש `source_thought_id`, עם לינק
    "פתח" שמפעיל את `ThoughtEditModal`. סוגר את הלופ בשני הכיוונים.

  **AI adapter (`src/lib/ai/thought-suggestions.ts`):**
  - `ThoughtAiProvider` interface עם `generateTitle` + `getSuggestions`.
  - `mockProvider` דטרמיניסטי עם היוריסטיקות של תאריכים/אנשים/פעולות
    מרובות. החלפה ל-Claude Haiku תהיה שינוי קובץ אחד; ה-UI לא זז.

  **חיפוש גלובלי — deep-link:**
  - `GlobalSearchPalette` מנתב ל-`?thought=<id>` (וגם לטיפוסים אחרים).
    `Thoughts.tsx` קוראת את ה-param ב-mount, פותחת את המודל, ומנקה
    את ה-URL כך שסגירה לא תפתח אותו שוב.

  **ווידג'ט דשבורד:**
  - `UnprocessedThoughts` (`src/components/dashboard/widgets/`) — חמש
    העליונות + badge של ספירה + לינק למסך. מחובר ל-`Dashboard.tsx`
    כ-preview מוקדם בזמן ש-DashboardGrid המלא עדיין לא מלא.

  **תוספות לשכבת הדאטה:**
  - `useThoughtAssignments(thoughtId)` + `useBulkThoughtAssignments(ids[])`
    (hooks) + `listAssignmentsForThoughts(ids[])` (service). ה-bulk
    מחזיק את מסך המחשבות על round-trip אחד של assignments לכל
    הכרטיסים יחד.

  **חוב טכני סגור בסשן הזה:**
  - **RRULE expansion** — `expandRrule(rule, anchor, start, end)`
    ב-`calendar-utils.ts` מחזיר את כל המופעים של חוק RFC-5545 בתוך
    החלון הנצפה. DAILY/WEEKLY(+BYDAY)/MONTHLY/YEARLY + INTERVAL +
    UNTIL. `Calendar.tsx` מרחיב אירוע חוזר לפריטים נפרדים שמייצגים
    מופעים שונים — לחיצה על כל מופע פותחת את האירוע-האב.
  - **Timezone picker** — `CalendarPrefs.timezone` (ברירת מחדל =
    הזיהוי של הדפדפן). `HourRangeSettings` מוסיף select עם חיפוש +
    כפתור "זיהוי אוטומטי". ה-chrome + `AgendaView` + `MonthView` +
    `CalendarBlock` (day/week) מעבירים את ה-TZ לפורמטרים. Gantt
    נשאר על הזמן המקומי של הדפדפן בסשן הזה (דיף קטן יותר; הפער שם
    חזותי זניח).

  **חוב טכני שנותר פתוח לפאזה 6:**
  - `EntityEditModal` משותף — נדחה בכוונה.
  - `projects.source_thought_id` — אין עמודה כזו עדיין בסכמה, לכן
    בפרויקטים שנוצרו ממחשבה ה-provenance נרשמת רק ב-
    `thought_processings`. מיגרציה קטנה בפאזה 6 תוסיף את העמודה.

  **החלטות שלא היו ב-SPEC המקורי:**
  - ה-AI adapter הוא client-side mock בלבד כרגע. ההחלטה לדחות
    אינטגרציה אמיתית ל-Anthropic API היא כדי לנעול את ה-UX לפני
    שמוציאים תקציב AI אמיתי — המבנה של ההצעות (קבועות + דינמיות)
    והממשק של ה-adapter נבדקו בפועל במסך.
  - מסך המחשבות לא משתמש ב-`DashboardGrid` (בניגוד ל-§14 שדיבר עליה
    לדשבורד הבית): המסך הוא טקסטארה אחת גדולה + פיד — לא אוסף
    ווידג'טים. ה-chrome היחיד מספיק לכל הבקרות הרוחביות.
  - סינון לפי "מעובדת/לא מעובדת" הפך ל-view mode ב-chrome (popover
    "תצוגה") במקום boolean ב-FilterBar — כי זה החיתוך העיקרי של
    המסך ולא סינון משני. ה-FilterBar מחזיק רק `sources[]` + `tags[]`.

- **2026-04-24 (החלטת ארכיטקטורה — אחסון קבצים)** —
  Cloudflare R2 מחליף את Supabase Storage לכל הקבצים (אודיו של
  הקלטות + מחשבות, תמונות מ-WhatsApp, צירופים). יושם בפאזה 6 (§18).

  **למה R2:** egress חינם, עלות צפויה בקנה מידה של שעות הקלטה ארוכות,
  S3-compatible כך שה-AWS SDK עובד as-is.

  **עיקרון אבטחה (§28 #9 חדש):** סודות R2 (`R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`) **לעולם לא בדפדפן**. כל env var עם prefix
  `VITE_*` נחבט ל-bundle הציבורי — נסיון להחביא שם secret = הדלק
  משולח לכל מבקר ב-DevTools. הכלל מורחב לכל שירות חיצוני
  (Anthropic, Gladia, Resend...).

  **ארכיטקטורה — adapter pattern דו-שכבתי:**
  - **Edge Function (Supabase, Deno):** `CloudflareR2Provider`
    מחזיק את ה-AWS S3 SDK + `@aws-sdk/s3-request-presigner`. סודות
    R2 חיים ב-Supabase secrets (לא `VITE_*`).
  - **Browser:** `storageService` thin client קורא לשלוש Edge Function
    endpoints — `presign-upload`, `presign-multipart`, `complete-multipart`.
    אין SDK של AWS בדפדפן.

  **הקלטות ארוכות (עד שעה+):**
  - Multipart upload **מההתחלה** של ההקלטה, לא בקפיצה ב-18 דק'.
  - כל chunk של ~5MB / ~2 דק' (מה שקורה קודם) → presigned PUT ישירות
    ל-R2 → R2 מחזיר ETag → שומרים ETag לקוונטיפיקציה ב-CompleteMultipart.
  - **IndexedDB persistence:** כל chunk נכתב ל-IndexedDB וה-row נמחק
    רק אחרי ack מ-R2. tab crash → טעינה מחדש משחזרת את ה-multipart
    הפתוח ומשלימה. אין איבוד הקלטה גם אחרי שעה.
  - ההקלטה עצמה לא נעצרת בשום נקודה — `XHR.upload.onprogress` ל-
    progress, ה-recorder לא יודע שיש העלאה ברקע.
  - ביטול הקלטה → `AbortMultipartUpload` באדג' פאנקשן + ניקוי IndexedDB.

  **משתני סביבה (לקבץ במחיצה ב-Supabase secrets):**
  - **Browser (`VITE_*`):** `VITE_R2_PUBLIC_URL` בלבד.
  - **Edge Function (Supabase secrets, *לא* `VITE_*`):**
    `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
    `R2_BUCKET_NAME`.

  **שינויי סכמה לפאזה 6 (יוסף ב-`recordings`):**
  - `storage_key text` (החליף את `storage_path` המתוכנן).
  - `storage_provider enum ('r2'|'supabase') default 'r2'`.
  - `multipart_upload_id text` — עוקב אחרי multiparts פעילים.
  - `status` יצא בערך חדש `'recording'` (לפני `'uploaded'`).

  **CORS על ה-bucket** (לקנפג ב-R2 Dashboard, לא בקוד):
  AllowedOrigins = production domain + `localhost:5173`; AllowedMethods =
  PUT/POST/GET/HEAD; ExposeHeaders חייב לכלול `ETag`.

  **Public access:** `Public Bucket = OFF`. הקלטות פרטיות דרך
  presigned-GET; בלבד הקלטות שהמשתמש שיתף מפורשות יקבלו public URL.

  **למה דחיתי את ההמלצה הקודמת ("VITE_R2_SECRET_ACCESS_KEY"):**
  זו הייתה טעות אבטחתית של הצ'אט הקודם. כל secret כזה ב-Vite
  נטמע ב-bundle ה-public. הארכיטקטורה החדשה מקיימת את אותה
  הפונקציונליות (browser-side `useFileUpload()` עם progress) בלי
  לחשוף שום סוד.

- **2026-04-24 → 2026-04-25** — **פאזה 5 polish: גל ארוך של תיקונים
  ושיפורים על מסך מחשבות + יומן + רוחבי**. סיכום של PRs #25-#45
  שנכנסו אחרי שלד פאזה 5.

  **מסך מחשבות (§19) — האבולוציה אחרי MVP:**
  - **AI חכם יותר עם תרחישים:** `mockProvider` עבר משילוב היוריסטיקות
    בודד למודל מבוסס תרחישים (exam / meeting / trip / birthday / שירות
    / תור / קניות). כל תרחיש מייצר 3-5 משימות מותאמות + הצעות אירוע
    מתאימות. ה-AI גם **לומד היסטוריה** — מקבל דגימה של 80 משימות
    אחרונות + tags ומשתמש בה לדירוג רשימות־יעד מועדפות (history-aware
    list ranking).
  - **תצוגת קנבן:** `ThoughtListsKanban` — עמודות פר-רשימה + עמודת
    "לא משויכות" מקובעת בצד הלידינג (sticky). גרירת כרטיס מעמודה
    לעמודה = **תנועה** (drag-as-move): המקור unassign, היעד assign.
    ה-`sourceListId` נישא ב-drag data, drop על "לא משויכות" מבטל
    את כל השיוכים.
  - **תצוגת רשימה:** מתחלפת עם הקנבן דרך toggle ב-chrome.
  - **ThoughtAiBanner משובץ ב-`ThoughtEditModal`:** הטאב "נוצרו מזה"
    מארח את אותו `ThoughtAiBanner` עם `embedded={true}` — כל פעולות
    היצירה (AI + ידני) זמינות גם מתוך מודאל-עריכת-מחשבה.
  - **מיזעור ברירת מחדל:** האזור של הצעות ה-AI מקופל כברירת מחדל;
    chevron פותח. הכפתורים הידניים תמיד גלויים.
  - **"לא משויכות" בפופאובר ה-`📎 לרשימה`:** כפתור אפור בראש הפופאובר
    שמבטל את כל השיוכים בלחיצה אחת — מקביל ידני לגרירה לעמודת
    "לא משויכות".
  - **בעיית קאש שתוקנה:** `useAssignThoughtToList` /
    `useUnassignThoughtFromList` ביטלו רק `allThoughts`, לא את שאילתת
    ה-`bulkAssignments`. תוקן עם `invalidateAssignmentQueries` משותף.
    משוב משתמש: "אני לא מצליחה להעביר מחשבה מרשימה לרשימה" — נסגר.
  - **באג Hebrew word-boundary:** `\b(מבחן)\b` החזיר תמיד false כי
    JS `\b` הוא ASCII בלבד. תיקון: `(?<![֐-׿])(...)(?![֐-׿])`
    סביב כל המילים העבריות ב-`mockProvider`. הכלל הזה חל על כל קוד
    שבודק "מילה שלמה" בעברית — לא להשתמש ב-`\b` ב-RegExp.
  - **modal autosave race ב-`TaskEditModal`:** לחיצה על X הפעילה blur
    שטריגר auto-save לפני שה-guard הספיק לקפוץ. תוקן ע"י refactor
    מלא ל-draft mode (טיוטה ב-state עד שמירה מפורשת).
  - **חיפוש גלובלי deep-link:** `?thought=<id>` ב-URL פותח את המודל
    ב-mount ומנקה את ה-param.

  **מסך יומן (§16) — איטרציות ויזואליות:**
  - **הערות פר-יום (`calendar_day_notes`):** מיגרציה חדשה. כפתור
    "הערה ליום" על מספר התאריך (ימין למספר במובייל, שמאל ב-RTL לפי
    בקשת המשתמש), עורך מודאלי קצר. הערות זמינות בכל התצוגות.
    כשל-migration: error message inline במודאל ההערה במקום fail
    שקט (אותו pattern יוסף בכל מקום שבו DB feature חדש לא הוחל
    עדיין).
  - **גובה דינמי:** הגריד נמתח לכל אורך ה-viewport (`hourHeight`
    מחושב מ-`window.innerHeight` פחות כותרות) במקום גובה קבוע — שעות
    יותר גדולות במסך גדול, גלילה במקום צמצום במסך קטן.
  - **גרירת בלוקים זמניים:** משימה/אירוע ניתנים לגרירה ביום/שבוע/חודש
    עם snap ל-15 דקות. בחודש: רק התאריך זז, השעה נשמרת. ביום+שבוע:
    גם השעה וגם היום. **Native HTML5 drag** — לא `@dnd-kit`, כי
    הבלוקים כבר absolute-positioned באופסטים פיקסליים ידועים.
  - **תווית קבועה "08:00 עד 09:00"** על כל בלוק/צ'יפ — הטווח גלוי
    תמיד, לא רק ב-tooltip.
  - **Tooltip עם תיאור:** ה-`CalendarItem` מכיל `description`;
    `itemTooltip()` מחזיר "כותרת\n\nתיאור" (קטוע ל-240).
  - **משוב חי בזמן גרירה:** pill צף "HH:mm עד HH:mm" עוקב אחרי
    הסמן ומתעדכן ב-`dragover`. למצב resize-end מציג את הסיום החדש,
    ל-resize-start את ההתחלה. מומש כ-portal גלובלי דרך
    `subscribeHover()` ב-`calendar-drag.ts`.
  - **גרירת פריטי כל-היום ורב-יומיים:** שורת "כל היום" בתצוגת שבוע
    הופכת ליעד שחרור (7 תאי-יום שקופים מתחת לרצועות). תאי חודש
    מקבלים drop של רצועות multi-day. דיוק: אירועי כל-היום לא יכולים
    להישחרר על השריג השעוני (כדי לא לאבד את דגל ה-all-day בשתיקה).
  - **ידיות שינוי גודל בקצוות (Gantt-style):** רצועות multi-day
    בתצוגות שבוע + חודש מציגות שתי ידיות זעירות בריחוף — drag של
    ידית הסיום ליום אחר → רק ה-end משתנה; ידית התחלה → רק ה-start.
    אירועי כל-היום: ידית הסיום מוסיפה יום ל-midnight (כי `ends_at`
    exclusive). משימות: resize-end מעדכן `duration_minutes`,
    resize-start מעדכן גם `scheduled_at`.
  - **ויזואליזציית דריסת צבע ברמת אירוע:** **מסגרת = צבע יומן
    מקורי, מילוי = צבע דריסה.** בלי דריסה = שני הצבעים זהים. מחליף
    את ה"דוט בפינה" שהיה לפני.
  - **יומני אירועים נפרדים מרשימות משימות:** טבלה חדשה `event_calendars`
    + `events.calendar_id` + `events.color` (אופציונלי, override
    ברמת אירוע). קישור דו-כיווני: `event_calendars.linked_task_list_id`
    ↔ `task_lists.linked_event_calendar_id`. שני שירותים
    (`linkCalendarToList`, `linkListToCalendar`) מנקים את המצביע
    ההפוך לפני קביעת זוג חדש. כפתור "+" inline ב-EventEditModal
    ובפופאובר הקישור — `EventCalendarEditDialog` חדש שחוזר ל-
    caller עם `onSaved(calendarId)`.
  - **סימון V למשימות בלוח** דרך `TaskCheckButton` (משותף עם מסך
    משימות). מילוי צהוב מותגי (`#facc15`) עם V כהה — הוחלף מהירוק
    הקודם לפי בקשת המשתמש "תעשה שהוי יהיה צהוב כמו צבעי האתר".
  - **חוב טכני שתוקן:** `MonthItemChip` ו-`CalendarBlock` היו
    `<button>` עם `<TaskCheckButton>` (button) בתוכם — HTML לא תקין
    שגרם ל-`dragstart` להישבר בכרום. כיום שניהם `<div role="button">`
    עם תמיכת מקלדת (Enter/Space). הכלל: **לעולם לא לבנות button
    בתוך button**.
  - **RRULE expansion** — אירועים חוזרים מורחבים למופעים נפרדים בתוך
    החלון הנצפה. גרירה של מופע מ-RRULE חסומה (ייתן feedback לעתיד).
  - **Timezone picker** + שמירה ב-`useCalendarPrefs` (localStorage).
  - **מיון תוצאות ב-month chip:** משימות שהושלמו ושעת ההתחלה
    שלהן 00:00 (= "ללא שעה ספציפית", `isHourless`) צונחות לתחתית.
    משימות עם שעה ממשית — נשארות בסדר הזמן.

  **רוחבי / תיקוני באגים:**
  - **רוחב מסכים (max-w):** `ScreenScaffold` קיבל prop `narrow`
    אופציונלי. ברירת מחדל = ללא הגבלה (היה `max-w-7xl` שיצר
    "מרווחים גדולים בצדדים"). מסכי טפסים ספציפיים (Settings)
    עוברים ל-`narrow` במפורש.
  - **מסך משימות:** הוסיף toggle "תצוגה" (קנבן/רשימה) ב-chrome.
  - **`react-grid-layout` widget** ל-Tasks הוסר — היה תקוע, החליפו
    אותו ב-grid CSS פשוט.
  - **כשל מיגרציה גלוי:** בכל מקום שבו DB feature חדש דורש מיגרציה
    שיתכן שלא הוחלה (notes, event calendars), ה-UI מציג שגיאה inline
    עם המסלול לקובץ ה-SQL במקום להיכשל בשתיקה.

  **קבצים חדשים שנוספו לתשתית הרוחבית:**
  - `src/components/calendar/calendar-drag.ts` — module-level state
    של גרירה (mode + grabOffsetMin + hover subscription).
  - `src/components/calendar/DragHoverPill.tsx` — portal גלובלי שעוקב
    אחרי הסמן ומציג את הזמן/תאריך החדש.
  - `src/components/calendar/EventCalendarEditDialog.tsx`,
    `LinkCalendarPopover.tsx` — UI ליומני אירועים.
  - `supabase/migrations/20260424000002_calendar_day_notes.sql`,
    `20260425000002_event_calendars.sql` — שתי מיגרציות חדשות.

  **החלטות ארכיטקטוניות שהתבססו בסשן הזה:**
  - **HTML5 native drag עדיף על `@dnd-kit` כשהמיקום כבר absolute** —
    ה-drop יכול להפוך מיקום פיקסלי לזמן. dnd-kit היה מאלץ wrapping
    `useDraggable` סביב כל בלוק וחישוב collisions שכבר קיים פיקסלית.
  - **Module-level drag state** (לא React context) — הגרירה היא
    אינטראקציה רגעית; אין צורך ב-re-render של עצים שלמים. ה-drop
    targets מסתכלים על `getDrag()` ו-`subscribeHover()` ישירות.
  - **`<div role="button">` כשמכניסים ילדים שהם buttons** — חוק
    מחייב מעכשיו ב-codebase כדי למנוע nested-button HTML.

  **חוב טכני שעבר לפאזה הבאה:**
  - גרירה של מופעי RRULE שגוררת את כל הסדרה (כרגע חסום).
  - `EntityEditModal` משותף ל-task/event (חוב פתוח כבר 2 פאזות).
  - `projects.source_thought_id` עמודה (מחשבה → פרויקט).
  - DashboardGrid מלא ליומן (CalendarStatsStrip הוא stand-in).

  **PRs שמסכמים את הגל:** #25-#45 (לרבות #28 hebrew regex,
  #30-#38 calendar polish batch, #39 event calendars, #40
  drag-as-move, #41 list↔calendar link, #42 inline +create,
  #43 override-as-border, #44 drag-drop + tooltip + collapse,
  #45 live drag pill + multi-day drag + resize).

  **רישום פר-PR (כל מה שעשינו בשיחה הזו, מהמוקדם ביותר):**

  - **PR #24** — שלד פאזה 5 (מסך מחשבות §19) + RRULE expansion
    + Timezone picker + תיעוד החלטת R2.
  - **PR #25** — `mockProvider` חכם יותר: previews בכרטיסי הצעות
    AI + תצוגת קנבן `ThoughtListsKanban` (עמודות פר-רשימה).
  - **PR #26** — `mockProvider` עבר למודל תרחישים (exam / meeting
    / trip / birthday / שירות / תור / קניות) שמייצר 3-5 משימות
    מותאמות + דירוג רשימות־יעד מבוסס היסטוריה (80 משימות אחרונות).
    בקשת המשתמשת: "אני רוצה שגם יחשוב יותר מיזה. נגיד כתבתי לו
    שייש לי מבחן".
  - **PR #27** — `docs/claude-integration.md`: תוכנית מימוש מלאה
    למעבר מ-mock ל-Claude Haiku 4.5 דרך Edge Function. בקשת
    המשתמשת: "תכתוב לנו בmd שצריך לעשות את זה ונחזור לזה בערב".
  - **PR #28** — תיקון באג Hebrew word-boundary: `\b(מבחן)\b`
    החזיר תמיד false (JS `\b` ASCII בלבד). תיקון:
    `(?<![֐-׿])(...)(?![֐-׿])`. **הכלל מעתה
    ב-codebase: לא להשתמש ב-`\b` עם עברית.**
  - **PR #29** — 5 תיקונים במחשבות/מודאלים: עורך רשימות במקום,
    manual fallback ב-AI banner, partial-processed badge, project
    deep-link, save+guard hardening.
  - **PR #30** — 5 תיקונים: סגירת תפריט "מה עם המחשבה?" רק
    כשהיו שינויים, רשימת פר-פרויקט, guard hardening,
    **TaskEditModal autosave race fix** (refactor מלא ל-draft mode
    כי X גרם ל-blur שטריגר auto-save לפני ה-guard) + **Tasks
    layout toggle** (קנבן/רשימה ב-chrome). בקשת המשתמשת:
    "במשימות אם אני לא שומרת לא מופיעה הודעה קופצת גם אם שיניתי
    ולא שמרתי".
  - **PR #31** — `ScreenScaffold` קיבל prop `narrow` אופציונלי;
    ברירת מחדל הוסרה מ-`max-w-7xl` לרוחב מלא. בקשת המשתמשת:
    "אני לא מבינה למה האמצע של המסך לא מתפרס על כל המסך".
    מסכי טפסים (Settings) משתמשים ב-`narrow` במפורש.
  - **PR #32** — תיקון month-view: מספרי תאריכים לא נחתכים יותר
    על-ידי band-overlay של אירועים (החלפה מ-`absolute z-20`
    לזרימה רגילה). בקשת המשתמשת: "בעמוד היומן יש בעיה שלא רואים
    את מספרי התאריכים".
  - **PR #33** — בורר event-or-task ב-slot click ביומן (לא רק
    אירוע); deferred-apply ב-AI suggestion (יוצר רק אחרי save
    מפורש במודאל, לא ברגע הלחיצה). בקשת המשתמשת: "כשאני פותחת
    הצעה של AI ויצאתי בלי לגעת בכלום" — לא צריך ליצור.
  - **PR #34** — Gantt click-to-create + יומן: גובה דינמי שנמתח
    לכל אורך ה-viewport (`hourHeight` מחושב מ-`window.innerHeight`).
    בקשת המשתמשת: "במסך יומן- תגדיל את היומן עוד כלפי מטה".
  - **PR #35** — הערות פר-יום: מיגרציה `calendar_day_notes` +
    כפתור "הערה ליום" על מספר התאריך + עורך מודאלי. הערות בכל
    התצוגות (יום/שבוע/חודש).
  - **PR #36** — סימון V למשימות בכל תצוגות היומן דרך
    `TaskCheckButton` משותף; **כשל-מיגרציה גלוי** (error inline
    במודאל ההערה במקום fail שקט). בקשת המשתמשת: "תאפשר בתצוגת
    יומן, סימון וי על משימות" + "השמירה של הערה ביומן לא עובדת.
    תתקן".
  - **PR #37** — מיקום הערה (שמאל למספר במובייל, ימין במסך), tooltip
    על הערה, צ'קבוקס קטן יותר (12-14px עם 1px border, 2.5
    stroke), מיון `isHourless` (משימות שהושלמו ב-00:00 צונחות
    לתחתית, עם שעה ממשית — נשארות בסדר). בקשת המשתמשת:
    "הערה צריכה לעבור לצד שמאל" + "ממש מאסיבי" על הצ'קבוקס.
  - **PR #38** — V צהוב (`#facc15`) במקום ירוק עם V כהה; נקודה
    אדומה זעירה ל-overdue במקום רקע אדום. בקשת המשתמשת:
    "תעשה שהוי יהיה צהוב כמו צבעי האתר".
  - **PR #39** — **יומני אירועים נפרדים מרשימות משימות.**
    מיגרציה `event_calendars` חדשה + `events.calendar_id` +
    `events.color` (override אופציונלי ברמת אירוע) + קישור
    דו-כיווני: `event_calendars.linked_task_list_id` ↔
    `task_lists.linked_event_calendar_id`.
  - **PR #40** — תיקון קאש: `useAssignThoughtToList` /
    `useUnassignThoughtFromList` ביטלו רק `allThoughts`, לא את
    `bulkAssignments`; תוקן עם `invalidateAssignmentQueries`
    משותף. + **drag-as-move semantics** במחשבות (גרירה מעמודה
    לעמודה = unassign+assign, לא duplicate). בקשת המשתמשת:
    "אני לא מצליחה להעביר מחשבה מרשימה לרשימה".
  - **PR #41** — list-edit popover: כפתור "קישור ליומן"
    בעריכת רשימה (`LinkCalendarPopover`), עם error inline על
    כשל מיגרציה. בקשת המשתמשת: "תאפשר גם להחזיר משימה חזרה
    לרשימת לא משוייכות".
  - **PR #42** — כפתור "+" ליצירת יומן חדש inline ליד dropdown
    היומן ב-`EventEditModal` וב-`LinkCalendarPopover`.
    `EventCalendarEditDialog.onSaved(calendarId)` מחזיר את
    ה-id החדש לבחירה אוטומטית.
  - **PR #43** — **דריסת צבע = border + fill:** מסגרת בצבע
    היומן המקורי, מילוי בצבע הדריסה. ללא דריסה: זהים. הוסר
    "הדוט בפינה". + **`ThoughtAiBanner` משובץ** ב-`ThoughtEditModal`
    טאב "נוצרו מזה" (`embedded={true}`). + **"לא משויכות" אפור**
    בראש פופאובר השיוך בכרטיס מחשבה. בקשת המשתמשת: "כרגע זה את
    צבע היומן המקורי בקודה קטנה" + "תן לי יכולת להוסיף מכאן".
  - **PR #44** — **גרירה ושחרור ביומן:** משימות + אירועים נגררים
    ביום/שבוע/חודש עם snap 15 דקות (Native HTML5 drag). +
    **Tooltip עם תיאור** (`itemTooltip()` מציג כותרת + תיאור 240
    תווים). + **מיזעור הצעות AI** (chevron). בקשת המשתמשת
    הקריטית: "אין יכולת גרירה של משימה או אירוע ביומן".
  - **PR #45** — **live drag time pill** (`HH:mm עד HH:mm` צף
    שעוקב אחרי הסמן ומתעדכן בזמן אמת) + **תווית קבועה
    "08:00 עד 09:00"** על כל בלוק/צ'יפ + **גרירת פריטי כל-היום
    ורב-יומיים** (שורת "כל היום" בשבוע + תאי חודש כיעדי שחרור)
    + **ידיות שינוי גודל בקצוות סגנון Gantt** (start/end handles
    על רצועות multi-day). + **תיקון קריטי:** `MonthItemChip` ו-
    `CalendarBlock` שונו מ-`<button>` ל-`<div role="button">` כי
    `<TaskCheckButton>` (button) בתוכם יצר HTML לא תקין שגרם
    ל-`dragstart` להישבר. + **AI default = מקופל**. בקשת
    המשתמשת: "אין יכולת גרירה של משימה או אירוע ביומן - קריטי"
    + "בתצוגת חודש אני לא מצליחה לגרור" + "הצעות AI עשית שניתן
    למזער תעשה שכברירת מחדל זה קודם ממוזער".
  - **PR #46** — תיעוד פאזה 5 polish ב-SPEC §16/§19/Changelog +
    `docs/phase-6-prompt.md` (פרומט עצמאי לצ'אט חדש לפאזה 6).

- **2026-04-26 → 2026-04-27** — **פאזה 6 הסתיימה חלקית: 6א (R2)
  + 6ב (UI הקלטות) על main. 6ג (Gladia + Claude) פתוח.**

  **פאזה 6א — תשתית Cloudflare R2 (PR #51, ללא UI):**
  - מיגרציה `20260426000002_recordings_r2_storage.sql`: rename
    `recordings.storage_path` → `storage_key` (סמנטית — object key,
    לא file-system path), הוספת enum `storage_provider` ('supabase'
    | 'r2') כדי ששורות legacy מ-QuickCapture יוכלו לדור עם R2
    החדש, default flip ל-`'r2'`, עמודה `multipart_upload_id`
    שדגלה ל-uploads בפעולה. אותו rename גם ב-`task_attachments`
    לאחידות אוצר־מילים.
  - מיגרציה `20260426000001_recording_status_add_recording.sql`:
    הרחבת status ל-`'recording'` למצב in-progress (לפני העלאה
    מלאה), מבדיל מ-`'uploading'`/`'uploaded'`/`'transcribing'`/
    `'ready'`/`'failed'`.
  - Edge Function `supabase/functions/storage`:
    - `_shared/r2-client.ts` — חתימת AWS-Sigv4 ידנית מול
      `<account>.r2.cloudflarestorage.com` (Deno + Web Crypto, בלי
      AWS SDK כדי לא לגרור 8MB ל-edge runtime).
    - `_shared/auth.ts` — verify של Supabase JWT ב-Edge.
    - `_shared/cors.ts` — CORS משותף.
    - `index.ts` — נקודות קצה: `presign-multipart` (יוצר uploadId
      ומחזיר URL לחלק הראשון), `presign-part` (URL לחלק n נוסף),
      `complete-multipart` (סוגר את ה-upload, יוצר/מעדכן שורה
      ב-`recordings`), `abort-multipart`, `get-download-url`.
  - **למה multipart:** הקלטה של 1.5 שעות ≈ 100MB ב-Opus@128kbps;
    upload יחיד יישבר על רשת זזה. Multipart מאפשר העלאה מקבילית
    להקלטה — chunks של ~5MB נשלחים תוך כדי הקלטה במקום אחרי
    סיום.
  - **למה לא Supabase Storage:** R2 ב-zero egress fees, ועלות
    אחסון משמעותית נמוכה יותר על קבצי אודיו ארוכים. Supabase
    Storage נשאר זמין כ-`provider='supabase'` ל-rows ישנים +
    fallback אם R2 ייפול.

  **פאזה 6ב — UI מסך הקלטות (PRs #53–#67):**

  - **PR #53** — שלד מסך הקלטות (`/app/recordings`) על תשתית 6א:
    `RecordingsListBanner` (כמו `ListsBanner` ביומן/משימות),
    `RecordingFilters` (סטטוס · ספק · טווח תאריכים · רשימה ·
    פרויקט), `RecordingCard` (תאריך + שם + משך + סטטוס + actions),
    `RecordingPlayer` (נגן בסיסי + placeholder לתמלול). יצירה
    ראשונית מתבצעת עדיין דרך FAB → QuickCapture → upload לסופאבייס
    (יוסב ל-R2 ב-PR #54).
  - **PR #54** — **מקליט בתוך האפליקציה:**
    `RecorderPanel` + `RecorderModal` עם pause / resume / discard,
    timer חי, ויזואליזר. + **QuickCapture FAB עברה ל-R2 multipart**
    (במקום upload יחיד ל-Supabase). `recordingService.start()`
    כעת קורא ל-`/storage/presign-multipart` ומעלה chunks תוך כדי
    הקלטה דרך `MediaRecorder` עם `timeslice=5000`. סטטוס מתעדכן
    `'recording'` → `'uploading'` → `'uploaded'`.
  - **PR #55** — נגן מותאם, 3-banner header (ListsBanner + Filters
    + Player-Strip), פילטרים מורחבים, **תיוג פרויקט** ישיר ב-card,
    **תיקון "המשך הקלטה" שלא עבד:** המקליט שמר `mediaRecorder`
    כ-state אבל React batching דרס את ה-stream בריענון. תוקן עם
    `useRef` ל-MediaRecorder + flush מפורש של ה-chunks הצבורים
    לפני pause.
  - **PR #56** — **קישוריות (linkage) להקלטה.** מיגרציה חדשה
    `20260427000001_recording_links.sql`: הקלטה יכולה להיות
    מקושרת לרשימת משימות, ליומן אירועים (`event_calendars`),
    ולרשימת הקלטות (`recording_lists`, חדש). M:N דרך
    `recording_link_targets` פולימורפית.
    `RecordingLinkagePanel` חדש מציג את כל הקישורים פר-הקלטה.
  - **PR #57** — UI polish: filters קופלים, באנרים compact,
    waveform visualizer, באנר grouping (בין השאר: "לפי תאריך
    יצירה / לפי פרויקט / לפי רשימה").
  - **PR #58** — EQ-bar visualizer במקום waveform (פחות יקר
    בחישוב; עובד על audio element ישיר במקום על Web Audio API),
    **skip-buttons עובדים** (היה באג שב-`audio.currentTime +=`
    על `<audio>` עם stream-source לא קופץ — תוקן עם החלפה ל-blob
    URL אחרי upload), חלוקה לסקציות בנגן, layout נשמר ב-
    `localStorage`.
  - **PR #59** — צ'יפים של status/source חזרו (היו hidden
    בטעות ב-#57), ה-grouping מקופל בתוך ה-filters card במקום
    סורגן נפרד.
  - **PR #60** — **פיצול הנגן ל-2 סקציות:** `שיוך` (ניתנת
    לעריכה — שם, פרויקט, רשימה, יומן, dropdowns מקושרים
    ל-`useTaskLists`/`useEventCalendars`/`useProjects`) + `משויך`
    (read-only — מציג ויזואלית את הקישורים שכבר קיימים).
  - **PR #61** — top row משתמש ב-flex כך שכרטיס ה-filters גדל
    לכיוון הלידינג (ימין ב-RTL) במקום להישאר רוחב קבוע.
  - **PR #62** — רשימת הקלטות compact למובייל בלבד: title-only
    rows, max-height capped עם scroll פנימי, expansion ל-card
    מלא ב-tap.
  - **PR #63** — אייקונים בצ'יפי linkage, seek bar שמתקדם תוך
    כדי playback (היה תקוע בגלל race ב-`setInterval`),
    EQ-bars צפופים יותר, `RecordingsMobileDropdown` ל-actions
    במובייל.
  - **PR #64** — filters בגודל הנכון (היו רחבים מדי במסך גדול),
    bars dense narrow, **סקציית `משויך` הוסרה** (תיחזור ב-#66),
    **כפתור "הקלט" ב-Thoughts** — מסך מחשבות יכול לפתוח
    `RecorderModal` ישר ולהצמיד את ההקלטה למחשבה.
  - **PR #65** — **inline create על pills של linkage:** "+"
    קטן בכל popover שיוך → פותח dialog ליצירה (רשימה / יומן /
    פרויקט) שחוזר עם id חדש לשיוך אוטומטי. אותה תבנית כמו
    `EventCalendarEditDialog.onSaved(id)` מ-PR #42. + ה-top
    banner יושר לגובה אחיד. + `AudioPlayer` משובץ בתוך
    `ThoughtEditModal` (טאב "אודיו") כשלמחשבה יש הקלטה
    מקושרת.
  - **PR #66** — `משויך` חזר כ-grid summary read-only מתחת
    ל-`שיוך` (היה חסר משוב משתמש: "אני לא רואה איפה ההקלטה
    משויכת").
  - **PR #67** — header `משויך` הוסר (סקציה עצמה נשארה),
    אייקון מהירות נגינה (`×1.0` / `×1.5` / `×2.0`) inline
    בצד הלידינג של הנגן במקום dropdown.

  **קבצים חדשים בתשתית:**
  - `src/components/recordings/` — `RecorderModal`, `RecorderPanel`,
    `RecordingPlayer`, `RecordingCard`, `RecordingFilters`,
    `RecordingLinkagePanel`, `RecordingDropZone`, `AudioPlayer`,
    `QuickRecordCard`, `RecordingsListBanner`,
    `RecordingsMobileDropdown`.
  - `supabase/functions/storage/` + `_shared/{r2-client,auth,cors}.ts`.
  - 3 מיגרציות חדשות (`recording_status_add_recording`,
    `recordings_r2_storage`, `recording_links`).

  **החלטות ארכיטקטוניות שהתבססו בסשן:**
  - **AWS SDK דרך `npm:` ב-Deno** — ה-Edge Function משתמשת ב-
    `@aws-sdk/client-s3` הסטנדרטי דרך מנגנון ה-`npm:` של Deno
    במקום לחתום Sigv4 ידנית. R2 הוא S3-compatible אז ה-SDK
    עובד as-is מול `<account>.r2.cloudflarestorage.com`.
  - **MediaRecorder עם timeslice + multipart מקבילית** — chunks
    עוזבים את הדפדפן תוך כדי הקלטה. אם ההקלטה מתפצרצת אי פעם,
    כל מה שכבר עלה נשמר.
  - **`useRef` לכל אובייקט media** (MediaRecorder, MediaStream,
    AudioContext) — לא state. React batching שובר אותם.
  - **storage_provider enum מהיום הראשון** — לא single-flag
    boolean, כי בעתיד ייתכנו עוד providers (S3 ישיר, GCS).

  **מה פתוח לפאזה 6ג (חיבור AI):**
  - Edge Function חדשה `supabase/functions/transcribe`:
    - שולחת `r2_signed_url` ל-Gladia עם webhook callback.
    - עדכון `recordings.status='transcribing'` → Realtime UI.
    - Webhook מקבל transcript+speakers+timestamps, שומר
      `transcript_text`/`transcript_json`.
  - Edge Function נוספת `summarize` (או step בתוך `transcribe`):
    - Claude Haiku 4.5 → `{summary, my_tasks, their_tasks,
      speakers_hint}`. (`docs/claude-integration.md` מתעד את זה
      כבר מ-PR #27.)
    - יצירת `tasks` rows מהפלט עם שיוך ל-recording.
  - UI ל-speaker tagging ("זה אני / זה דני לקוח") — ב-
    `RecordingPlayer.tsx:115` יש כבר placeholder. בלחיצה,
    משימות מ-`their_tasks` מוקצות לדובר הנבחר.
  - **לא חסר UI** — כל ה-status states (`transcribing`/`ready`/
    `failed`), שדות ה-DB (`transcript_text`/`transcript_json`/
    `summary`/`extracted_tasks`) ו-realtime listeners כבר במקום
    מפאזה 1.

  **PRs בפאזה זו:** #51 (R2), #53–#67 (recordings UI + polish).

- **2026-04-27** — **פאזה 6ג שלב 1/2: חיבור Gladia (תמלול).**

  הצעד הראשון מתוך השניים בפאזה 6ג. `triggerProcessing()` הפסיק
  להיות stub — היום הוא קורא לפונקציה חדשה ב-Edge שיוצרת job
  אצל Gladia ומחכה לוובהוק.

  **Edge Functions חדשות:**
  - `supabase/functions/transcribe/` — מקבל `{ recording_id }`
    מהדפדפן (אחרי auth דרך `requireMember`), מאמת שההקלטה ב-R2 +
    שייכת לארגון של המשתמש, מייצר presigned GET (~1h) על אובייקט
    ה-R2, ושולח POST ל-`https://api.gladia.io/v2/pre-recorded`
    עם `audio_url` + `callback_url` + `diarization=true` +
    `language_config.languages=['he']`. שומר את `provider='gladia'`
    + `provider_job_id` ומחליף status ל-`'transcribing'`.
    אידמפוטנטי — קריאה שנייה על job שכבר רץ/הסתיים = no-op.
  - `supabase/functions/transcribe-webhook/` — מקבל את ה-callback
    מ-Gladia. **חייב `verify_jwt = false`** כי ל-Gladia אין JWT
    של Supabase; האימות הוא דרך `?token=<GLADIA_WEBHOOK_TOKEN>`
    שמתחלף ב-shared secret. מאתר את ההקלטה לפי `provider_job_id`,
    שומר `transcript_text` + `transcript_json` (כל ה-payload של
    Gladia, לרבות utterances + speakers + timestamps) +
    `speakers_count`, ועושה `upsert` ל-`recording_speakers`
    (אינדקסים 0-based).
  - `supabase/config.toml` חדש (לא היה בריפו) — מצהיר `verify_jwt
    = false` רק ל-`transcribe-webhook`. כל פונקציה אחרת (storage,
    transcribe) ממשיכה עם ברירת המחדל המאובטחת.

  **State machine מורחב:**
  - `'uploaded'` → `'transcribing'` (לחיצה על "התחל תמלול"
    → submit ל-Gladia)
  - `'transcribing'` → `'extracting'` (Gladia הודיע `done`,
    transcript נשמר; הסטטוס הזה הוא הזנב של פאזה 6ג שלב 2 = Claude)
  - **fallback זמני:** אם `ANTHROPIC_API_KEY` עדיין לא מוגדר
    כסוד ב-Supabase, הוובהוק קופץ מ-`'extracting'` ישר ל-`'ready'`
    כדי שה-UI לא יישאר תקוע. ביום שמוסיפים את `summarize`,
    מסירים את ה-fallback הזה.
  - `'transcribing'` → `'error'` כשהפעלה נכשלה אצל Gladia או
    שהוובהוק קיבל `error_code`. `error_message` נשמר עם הסיבה.

  **שינויי UI ב-`RecordingPlayer.tsx`:**
  - חולץ קומפוננט פנימי `TranscriptionSection` שמתפצל לפי
    `recording.status`:
    - `uploaded` → כפתור `התחל תמלול` (קורא ל-`useTriggerRecordingProcessing`).
    - `transcribing` → spinner + "מתמללת...".
    - `extracting` → spinner + "מחלצת משימות..." (placeholder
      לפאזה הבאה).
    - `ready` + יש `transcript_text` → preview גלילתי (max-h-60)
      עם מספר הדוברים.
    - `error` → קופסה אדומה עם `error_message` + כפתור "נסה שוב".
  - ה-placeholder עם הטקסט "תמלול וסיכום AI מתוכננים לפאזה
    הבאה" (PR #53) הוסר.

  **שינוי ב-`src/lib/services/recordings.ts`:**
  - `triggerProcessing(recordingId)` — היה
    `updateRecording(id, { status: 'transcribing' })` יבש; עכשיו
    קורא בפועל ל-`/functions/v1/transcribe` עם JWT. שגיאה
    מ-Gladia מתורגמת ל-`error_message` ב-DB דרך ה-Edge Function
    עצמה (לא בקליינט) — הקליינט רק זורק לאחר non-2xx וה-Realtime
    מעדכן את הסטטוס.

  **secrets שצריך להגדיר ב-Supabase Edge Functions לפני שזה ירוץ:**
  - `GLADIA_API_KEY` — מ-<https://app.gladia.io>.
  - `GLADIA_WEBHOOK_TOKEN` — מחרוזת אקראית (32+ תווים) שמייצרים
    מקומית, שומרים ב-Supabase secrets, ולא חולקים בשום מקום
    אחר. הוא חוזר חזרה ב-callback URL של כל job ומאומת על כל
    קריאה לוובהוק.
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
    — כבר קיימים מהפאזות הקודמות.

  **deploy:**
  ```
  supabase functions deploy transcribe
  supabase functions deploy transcribe-webhook --no-verify-jwt
  ```
  (ה-`--no-verify-jwt` מיותר אם ה-`config.toml` נקרא אוטומטית
  ע"י ה-CLI; משאיר אותו ב-command כ-belt-and-suspenders.)

  **מה פתוח לשלב 2 של פאזה 6ג (Claude):**
  - `summarize` Edge Function נפרדת (או step בתוך transcribe-webhook):
    - מקבל `transcript_text` + `recording_id`, קורא
      ל-Claude Haiku 4.5 (פרומט מ-`docs/claude-integration.md`),
      מחזיר `{ summary, my_tasks, their_tasks, speakers_hint }`.
    - יוצר `tasks` rows + `recording_tasks` שיוך לדובר.
    - מחליף status ל-`'ready'`. מסיר את ה-fallback מהוובהוק.
  - UI לתיוג דובר (`recording_speakers.role`/`label`) ב-
    `RecordingPlayer.tsx` — היום הדוברים נשמרים בלי label.
    בלחיצה "זה אני / זה דני לקוח", `tasks` המקושרים לדובר
    דרך `recording_tasks.assigned_to_speaker_index` יקבלו
    `assignee_user_id`.

  **שינוי תיעודי קטן:** הבולט "AWS Sigv4 ידני בלי SDK" בערך
  הקודם של פאזה 6 הוסר — בפועל `r2-client.ts` משתמש ב-
  `npm:@aws-sdk/client-s3` הסטנדרטי. הבולט הוחלף בתיאור מדויק.





- **2026-04-28 — סשן ארוך, 29 PRs (#69–#97).** התחיל מתמלול תקוע ונגמר בצינור AI מלא, עורך תמלול prompter, איחוד N הקלטות, ועוד.

  **בלוקרים שנפתחו (פאזה 6ג בעצם הסתיים בסשן הזה):**
  - **#69** — `transcribe-webhook` היה מחפש `body.status==='done'` ו-`body.result`, אבל Gladia v2 שולח `body.event==='transcription.success'` ו-`body.payload`. כל בקשה החזירה 200 עם `ignored` ולא עדכנה את ה-DB → ההקלטות תקעו ב-`transcribing`. ה-webhook עכשיו מקבל את שתי הצורות + מלוגג את ה-body כדי שמיסמאצ'ים עתידיים יהיו ברורים מ-Logs.
  - **#69** — הוקם **GitHub Actions workflow** (`.github/workflows/deploy-edge-functions.yml`) שמטמיע אוטומטית את כל ה-Edge Functions בכל push ל-main שנגע ב-`supabase/functions/**` או `supabase/config.toml`. דורש `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_ID` ב-repo secrets.
  - **#83** — MP4 multipart upload תקע ב-99% כי `complete-multipart` ל-R2 לא חזר. בדיקה ב-Network הראתה שכל ה-chunks נכנסו אבל ה-Complete תקע. במקום לחקור פאת R2, הועלה ה-`SINGLE_UPLOAD_MAX_BYTES` מ-5MB → **100MB** — קבצים מתחת לסף עוברים ב-PUT בודד ישירות ל-R2 בלי המעורבות של ה-edge function. R2 תומך ב-PUT בודד עד ~5TB, התקרה האמיתית פה היא זיכרון של הדפדפן.
  - **#82** — סטטוס `'extracting'` היה שלב ביניים מתוכנן בין transcribe ל-AI. אחרי שה-AI נעשה ידני, הקוד נשאר ב-`extracting` לנצח. עכשיו ה-webhook עובר ישר ל-`'ready'` והשלב `'extracting'` נחשב ב-UI כ-`ready` לטובת הקלטות ישנות שתקעו.

  **AI Pipeline חדש לגמרי (PR #81 + #85 + #86 + #94 + #96):**
  - Edge Function חדש `summarize/index.ts` שקורא ל-**Claude Sonnet 4.6** עם **tool-use** (#96 — JSON מובטח, אי אפשר לשבור).
  - מבנה output: `short_summary`, `long_summary`, `whatsapp_message`, `email{subject,body}`, `tasks[]`, `events[]` — לפי schema של tool-use.
  - **prompts ניתנים לעריכה פר-משתמש** (#86) — מיגרציה `20260427000006` הוסיפה `recording_ai_prompts jsonb` ל-`user_thought_preferences`. ל-summarize יש 6 הנחיות (per section); ברירת מחדל מוגדרת ב-`src/lib/ai/recording-prompts.ts` ובמראה ב-`summarize/index.ts` `DEFAULT_PROMPTS` (חייבים להישאר זהים — Deno לא יכול לייבא מ-Vite). UI דרך **AiPromptsDialog** נגיש מ-Thoughts → ⚙ ומ-Recordings header (#91).
  - **prompts אישיים** (#96) — WhatsApp ומייל כותבים "היי \<שם\>" עם שם הדובר השני (לפי `recording_speakers.label`).
  - הסטטוס נע אוטומטית: `processing` בזמן הקריאה ל-Claude → `processed` בסוף. enum הורחב במיגרציה `20260427000005`.

  **משימות AI עם בקרה מלאה (PR #85 + #90 + #92 + #94 + #96):**
  - הסקציה משימות תמיד גלויה — אפשר למלא ידנית גם בלי AI. "+ הוספת משימה" + "צור את כולן" + שמירת ערכים.
  - **TaskEditModal פתוח ב-CREATE mode** (#90) מ-"צור משימה" — אותו מודאל עריכה כמו במסך משימות, עם list / dependencies / scheduling.
  - **bulk-create N משימות לרשימה אחת** (#92) — בחירת רשימה → כל המשימות נוצרות בה → באנר "פתחי מסך משימות לעריכה מלאה" / "סגירה והמשך עיבוד".
  - **משימות מפוצלות לפי דובר** (#94) — קיבוץ "המשימות שלי / משימות עבור \<שם\> / ללא דובר" + chip filter למעלה לכבות/להדליק קבוצות (#96).
  - **מתג מצב per speaker** (#96) — "משימות" (UI הקיים) או "טקסט" (בלוק טקסט עם "היי \<שם\>" + WhatsApp / מייל / העתק לשליחת כל הקבוצה במכה).
  - **שדה priority** הוסר מ-`<TaskRow>` (#97) — אין סטטוס כזה במערכת. השדה נשאר ב-DB.

  **עורך תמלול prompter (PR #73 + #76 + #84):**
  - per-utterance editing — לחיצה על זמן → seek לאודיו, edit text → debounced save שמעדכן `transcript_json.utterances[i].text` + recompute של `transcript_text`.
  - **prompter mode** (#76) — חלון ~5 שורות, גלילה אוטומטית כך שהשורה הפעילה במרכז, פאוז על "האזנה ידנית" 4 שניות אחרי כל scroll של המשתמש.
  - **קיבוץ דוברים** (#84) — Gladia מחזיר utterances כל 1-2 שניות; עכשיו utterances רצופות של אותו דובר נכנסות לבלוק אחד. בלוק > 15s נחתך לחתיכות של ~10s בגבולות utterance.
  - **עריכת שמות דוברים** (#95) — `<SpeakerEditorDialog>` עם play/pause לקטע של כל דובר (גבולות עם `timeupdate` כי HTML5 audio אין lookahead). תמיד "אני" כ-suggestion + תיוגי דוברים שנשמרו בעבר באותו פרויקט.

  **שיתוף תמלול ↔ מחשבה (PR #71 + #80):**
  - **Option C — append** (PR #71) — ה-webhook מסכרן `transcript_text` ל-`thoughts.text_content` של מחשבות מקושרות. אם תוכן קיים → צירוף בסוף עם `\n\n---\n`. אם ריק → קביעה.
  - **Auto-transcribe toggle** (#71) — מיגרציה `20260427000002` הוסיפה `user_thought_preferences` עם `auto_transcribe_recorded_thoughts boolean`. UI ב-Thoughts → ⚙. כש-on, הקלטה חדשה במחשבות קופצת אוטומטית ל-transcribe.
  - **Modal staleness fix** (#75) — ThoughtEditModal היה קורא state פעם אחת ב-`useEffect([thought?.id])` ולא היה מתעדכן כש-realtime מבטל cache. עכשיו `lastSyncedRef` משווה את הקלט הנוכחי לערך שהיה ב-server ב-sync האחרון, ומעדכן רק אם המשתמש לא הספיק להקליד.
  - **Client fallback** (#80) — להקלטות שתומללו לפני שה-webhook הוסיף את ה-Option C, פתיחה של המחשבה מסנכרנת אוטומטית בצד הלקוח.

  **איחוד הקלטות (PR #78 + #88 + #89):**
  - מיגרציה `20260427000003` הוסיפה `recordings.merged_into uuid → recordings(id) ON DELETE SET NULL`.
  - service `mergeRecordings({firstId, secondId})` (#78) — האחת סופחת תמלול של השנייה עם time-offset של duration; הראשונה שומרת את האודיו, השנייה מקבלת `merged_into = first.id` ו-audio_archived.
  - **N-recording merge UI** (#89) — דיאלוג עם רשימה ניתנת לסידור (חצים ▲▼), נגן per row (lazy presigned URL), הוספת הקלטה דרך picker פנימי. submit עובר דרך `useMergeRecordingsMany` שמחבר pairwise.

  **שיוך בתאי-meta (PR #93):**
  - הסיר את ה-`<RecordingLinkagePanel>` הנפרד ואת ה-Meta cells הקריאים-בלבד.
  - עכשיו פרויקט / יומן / משימות / רשימות הם **תאים editable** בסגנון `StatusMeta` — לחיצה פותחת popover עם אפשרויות + "**+ הוספת X חדש**" inline. פותר משימות חדשות מתוך הקלטה בלי לעבור מסך.

  **multi-file upload (PR #77):**
  - `<input multiple>` + ולידציה לכל קובץ + העלאה סדרתית. badge "קובץ X מתוך Y" כשהבאטץ' > 1. שגיאות נאספות ולא עוצרות את הבאטץ'.

  **עריכת שם הקלטה + מחיקה (PR #88):**
  - `<EditableTitle>` — קליק על הכותרת → input → Enter שומר, Esc מבטל.
  - `<DeleteButton>` — confirm דו-שלבי inline. שירות `deleteRecording(id)` ו-DB cascade מנקה speakers/lists/thought.recording_id.

  **תיקוני UI אגב (PR #79 + #80):**
  - הכפתורים של AudioPlayer חופפים במובייל — שינוי מ-`absolute end-0` ל-3-column grid (1fr/auto/1fr).
  - לחיצה על כרטיס מחשבה פתחה את העריכה רק ברקע המדויק; עכשיו role=button פותח מכל מקום (chips/menu עדיין עוצרים propagation).

  **שינויי סכמה בסשן (כולל פעולות ידניות אחרי מ-merge):**
  ```
  20260427000002_user_thought_preferences.sql
  20260427000003_recording_merge.sql
  20260427000004_recording_ai_output.sql
  20260427000005_recording_status_ai_phases.sql
  20260427000006_user_recording_ai_prompts.sql
  ```
  כולן הורצו ב-Supabase SQL Editor במהלך הסשן. אין מיגרציות פתוחות.

  **secrets שהוספו ב-session:**
  - `ANTHROPIC_API_KEY` (Supabase Edge Functions Secrets) — דרוש ל-`summarize`.
  - `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_ID` (GitHub repo secrets) — דרוש ל-CI שפורס edge functions.

  **build infra:**
  - הסשן חשף ש-`tsc --noEmit` שמרצנו לוקאלית לא תופס regressions ש-`tsc -b` כן (#87 תיקן 5 שגיאות שנצברו). מכאן והלאה: לפני push, להריץ `npx tsc -b` (לא רק `--noEmit`) או `npx vite build` שכולל את שניהם.

  **מה פתוח לשלב הבא:**
  - אין כיום שום פאזה פתוחה במסך הקלטות. כל הבקשות של הסשן הזה מומשו.

- **2026-04-30 — Layout / RTL / Calendar / Stats (PR #132 → #137):**

  **#132 — AI toolbar underlines.**
  - `<AiInsights>`: הוסר ה-dot indicator. Underline `h-0.5 inset-x-1 -bottom-0.5` שמשנה צבע — `bg-accent-yellow` כש-active, `bg-accent-orange` כש-`filled || count>0`, אחרת שקוף.

  **#133 — סידור דף פרויקט + Gantt empty title + Recordings v2.**
  - **PROJECT_WIDGETS** סודר מחדש (intent frame; *x=0 = visual right מאז #136*):
    ROW1 `[calendar w=4]` `[pricing w=4]` `[stats w=4]`, ROW2 `[tasks w=12]`, ROW3 `[summary w=12 h=3 קומפקטי]`, ROW4 `[upload w=4]` `[quote w=4]` `[templates w=4]`, ROW5 `[questions w=12]`.
  - **PricingActions בכותרת ProjectDetail** — 3 כפתורי מצב (קבוע/שעתי/הצעת מחיר) + שמרי (gradient כתום + flash "נשמר ✓"). ה-toggle הוסר מ-`<PricingBlock>`.
  - **Recordings v2** — 5 widgets תחת `src/components/recordings/widgets/`: `FiltersAndListWidget`, `QuickRecordTallWidget`, `UploadTallWidget`, `StatsTallWidget`, `PlayerWidget`. כולם מקושרים ב-`RecordingsPageContext`.
  - **Gantt empty-title fallback** — `gantt-utils.ts buildRows`: `t.title?.trim() || "ללא כותרת"` למשימות, `"אירוע ללא כותרת"` לאירועים. שורות עם title ריק לא יראו ריקות יותר.
  - מיגרציות `20260430000000_reset_recordings_layout_v2` ו-`20260430000100_reset_project_detail_layout_v2` הופעלו ידנית על production דרך MCP.

  **#134 — StatsBlock 4-KPI row + per-list progress bars.**
  - KPIs ב-`grid-cols-2 lg:grid-cols-4`.
  - `groupByList(tasks, allLists)` מקבץ לפי `task_list_id`, מתחבר ל-`useTaskLists()`.
  - `<ListProgressRow>` — שם רשימה + סטטוס (טרם החל / בפעיל / הושלמה) + פס מילוי gradient + תווית `actualH/estimatedH`.
  - משימות בלי `task_list_id` → "ללא רשימה". סידור לפי `total` יורד.

  **#135 — Recordings locked + Stats internal collapse + Calendar week grid.**
  - `<DashboardGrid>` קיבל prop חדש `lockedLayout` שמסתיר את toggle המצב ומחייב `isEditing=false`.
  - **`StatsTallWidget` internally-collapsible** — header לחיץ פנימי (BarChart3 + chevron). כש-closed ה-body נעלם לגמרי.
  - **`<CalendarBlock>` תצוגת שבוע משוכתבת** — מ-bar-chart compact ל-Google-Calendar-style: 7 עמודות ימים × 10 שורות שעות (7-16, ROW_PX=36). מקרא שעות בעמודה האחרונה. בלוקי `<WeekBar>` ב-`position:absolute` לפי דקת התחלה/משך.

  **#136 — RTL x-flip ב-DashboardGrid.**
  - הבעיה: מאז `direction:ltr` על `.react-grid-layout` (#130, RTL clipping fix), `x=0` נחת ב-visual left. בעברית RTL הקוראת מצפה לפריט הראשון בצד ימין.
  - הפתרון: שכבת flip ב-DashboardGrid. שני frames:
    - **intent frame** (`x=0 = visual right`) — widget defaults, layouts שמורים, callbacks.
    - **visual frame** (`x=0 = visual left`) — מה ש-react-grid-layout מקבל.
  - `flipX(layout, cols)`: `x' = cols - x - w`. flip של flip = identity.
  - `filteredLayouts` עובר flip לפני RGL. `handleLayoutChange` עושה flip חוזר לפני `scheduleSave`.
  - **משמעות עבור widget defs**: `Dashboard.tsx`, `ProjectBlocks.tsx`, `Recordings.tsx` ממשיכים להגדיר `defaultDesktop: { x, ... }` — אבל **המשמעות הויזואלית של x התהפכה**. וידג'ט שמוגדר `x=0` נחת ב-visual right. עורכי ה-defs צריכים לזכור: x גדל מימין לשמאל.
  - מיגרציה `20260430010000_reset_layouts_for_rtl_flip` — `DELETE FROM user_dashboard_layouts;` (אגרסיבית — כל המסכים, כל המשתמשים). הופעלה על production.

  **#137 — Recordings page match-screenshot + locked chrome.**
  - **layout חדש** לפי צילום שהמשתמשת שלחה (intent frame):
    ```
    filters_list:  x=0,  w=3, h=12   (עמודה ימנית מלאה)
    stats:         x=3,  w=3, h=4    (top row)
    quick_record:  x=6,  w=3, h=4
    upload:        x=9,  w=3, h=4
    player:        x=3,  w=9, h=8    (מתחת ל-3 הבאנרים)
    ```
  - **QuickRecordTallWidget / UploadTallWidget** — חזרו לעיצוב המלא. הגרסה narrow-tall (w=1) שכתבתי ב-#135 הוסרה.
  - **StatsTallWidget**: `useState(false)` → סגור כברירת מחדל.
  - **ביטול עריכה אישית ב-locked layout** — class חדש `widget-edit-only` על overlay הצף של `<BareChrome>` (drag/collapse/hide), ו-CSS rule `.grid-locked .widget-edit-only { display: none !important }`. ה-collapse הפנימי של filters/stats עובד דרך ה-header של ה-widget עצמו, לא דרך ה-overlay.

  **שינויי סכמה בסשן (כולן הופעלו דרך MCP):**
  ```
  20260430000000_reset_recordings_layout_v2.sql
  20260430000100_reset_project_detail_layout_v2.sql
  20260430010000_reset_layouts_for_rtl_flip.sql   (DELETE FROM user_dashboard_layouts;)
  ```

  **פתוח לסשן הבא — המשתמשת ביקשה להעביר וזה מה שצריך לסיים:**
  - **לאמת שה-RTL flip מופיע ב-Vercel production.** המשתמשת שלחה צילום של דשבורד שבו "מחשבות לא מעובדות" עדיין ב-visual left ולא ב-visual right (היא שאלה "האם אתה מצליח להבין שזה משמאל לימין?"). או שראתה את המסך לפני שה-deploy של #136 הסתיים, או שיש bug במימוש שלא מצאתי. צעדים: `npm run dev` לוקאלית, devtools לאמת `direction:ltr` על `.react-grid-layout` ו-`direction:rtl` על `.react-grid-item`, וש-`flipLayouts` רץ פעם אחת בכל כיוון. אם בעיה — לתקן. אחרת — לבקש hard-refresh.
  - **audit ל-LTR בתוך widgets פנימיים.** המשתמשת אמרה "הכיתוב כולו הוא משמאל לימין" — גם אחרי flip של מיקומי באנרים, ייתכן ויש text-align/flex-direction הפוכים בתוכן. מקומות לבדוק: `<UnprocessedThoughts>` rows, `<TasksBlock>` columns ו-rows, `<PricingBlock>` sliders, רשימות ב-`<FiltersAndListWidget>`.
  - **טבלת משימות** — "תהפוך את הצדדים בטבלה שתהיה מימין לשמאל ותתקן את זה שלא רואים את השורות". `<TasksBlock>` משתמש ב-`gridTemplateColumns: gridCols`. CSS Grid יורש direction מההורה, אז בתיאוריה אחרי #136 זה אמור להיות RTL. צריך אימות + reproduction של "לא רואים שורות".
  - **דף הקלטות אחרי #137** — המשתמשת אמרה "הרסת לי את דף ההקלטות" באמצע סשן. ב-#137 הצמדתי לצילום שלה. אם זה עדיין לא נכון אצלה — לבקש צילום עדכני אחרי deploy מלא + hard refresh, ולא לנחש.

  **build infra תזכורת:**
  - לפני push: `npx tsc -b && npx vite build`. `tsc --noEmit` לבד לא מספיק (#87).
  - מיגרציות חדשות: לוודא שמופעלות גם על production דרך MCP `apply_migration`, לא רק לקובץ.

- **2026-04-30 → 2026-05-01 — Cleanup pass: recordings + project + mobile.**
  סשן ארוך של תיקוני UI/UX על-בסיס משוב המשתמשת על המסכים שהיו פתוחים מ-#137. הוקם branch `claude/review-app-screens-FCYxZ`. כל קומיט מוזג ל-main בנפרד כדי ש-Vercel יפרוס בהדרגה.

  **מסך הקלטות — desktop:**
  - **הסטטיסטיקה הוטמעה ב-`<FiltersAndListWidget>`** במקום widget נפרד ב-top strip. עכשיו `FiltersAndListWidget` הוא card עם 3 שכבות accordion: סטטיסטיקה (סגור) → סינון (סגור) → רשימת הקלטות. כל אחת לוחצת לפתיחה ודוחפת את הבאות למטה — אותו pattern של הסינון על הרשימה. ה-widget `stats` הוסר מ-`RECORDINGS_WIDGETS`. `quick_record` ו-`upload` תפסו את העמודות שהתפנו (w=4 ו-w=5).
  - **שדה מקור editable** ב-`<RecordingPlayer>`: `<Meta label="מקור">` הקריא-בלבד הוחלף ב-`<SourceMeta>` עם `<select>` של 7 ערכים — `thought / call / meeting / recording / whatsapp / upload / other`. בחירת `other` חושפת `<input>` שנשמר ל-`source_custom` ב-blur.
  - **chevrons על כל ה-meta cells** — הוסף `<ChevronDown>` ל-`LinkMeta` ו-`RecordingListsLinkMeta` כדי שיראו interactive כמו `StatusMeta`/`SourceMeta`.
  - **toggle date-order חד-שורה** — שני tabs "חדש→ישן / ישן→חדש" שלא נכנסו לפאנל הצר הוחלפו בכפתור יחיד שמראה "חדש ↑" / "ישן ↓" ומתחלף בלחיצה.

  **מסך הקלטות — מובייל (<640px):**
  - הניסיון הראשון השאיר את ה-DashboardGrid ועשה את ה-`FiltersAndListWidget` compact picker ב-y=8 + player ב-y=0. המשתמשת ביקשה ההפך: סטטיסטיקה→סינון→רשימה למעלה, שורת כפתורים קומפקטית, ואז נגן.
  - **Recordings.tsx** עוקף את ה-DashboardGrid במובייל לחלוטין ועובר ל-flex column טבעי. הסיבה: react-grid-layout מקצה גובה קבוע לכל פריט (`h * rowHeight`), ואקורדיון שמשתנה בגובה גורם או לרווח כשסגור או לחפיפה כשפתוח. flex column מאפשר לכל widget לקבוע גובה לפי תוכן.
  - **`<FiltersAndListWidget>` mobile branch** מציג את 3 הסקציות (סטטיסטיקה / סינון / רשימה) באותה card; כולן `useState(false)` כברירת מחדל. בחירה ברשימה סוגרת אותה מיידית.
  - **`<QuickRecordTallWidget>` ו-`<UploadTallWidget>`** קיבלו mobile branch קומפקטי שמרנדר רק `[icon] + [label]`. הם נכנסים ל-`grid grid-cols-2 gap-2 h-14` באותה שורה ב-Recordings.tsx, במקום שני באנרים מלאים.
  - **`<PlayerWidget>`** עטוף ב-`min-h-[600px]` כדי שייראה מספק את הגובה שהוא רגיל אליו ב-grid.

  **מסך פרויקט (ProjectDetail.tsx):**
  - **`<TopInfoPanel>`** מאחד את 3 הבאנרים העליונים (יומן + תמחור + סטטיסטיקה) שהיו widgets נפרדים ב-PROJECT_WIDGETS לתוך card אחד מעל ה-DashboardGrid. סגירתו פעם אחת מצמצמת לרצועה דקה ומשחררת את כל המסך לטבלת המשימות (פתרון לבקשת המשתמשת "לראות יותר משימות").
  - **PROJECT_WIDGETS עודכן** — `calendar` / `pricing` / `stats` הוסרו. y-positions של widgets מתחת זזו למעלה: tasks y=0, summary y=6, upload/quote/templates y=9, questions y=13.
  - **ייצוא `PricingBlock` שונה ל-`export function`** כך ש-TopInfoPanel יכול לייבאו.
  - **TopInfoPanel mobile branch** — שלושת הבאנרים מתפצלים ל-3 `<MobileAccordion>` עצמאיים (calendar / pricing / stats), כולם סגורים כברירת מחדל. בלי זה הם הצטופפו ב-grid 3 עמודות ועלו זה על זה במסך צר.

  **מסד נתונים — extend recording source:**
  - מיגרציה `20260430030000_add_recording_source_values_and_custom.sql`:
    ```sql
    ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'recording';
    ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'whatsapp';
    ALTER TYPE recording_source ADD VALUE IF NOT EXISTS 'upload';
    ALTER TABLE recordings ADD COLUMN IF NOT EXISTS source_custom TEXT;
    ```
  - `src/lib/types/database.ts` עודכן ידנית — `recording_source` enum הורחב ושדה `source_custom: string | null` נוסף ל-Row/Insert/Update של `recordings`.
  - SOURCE_LABEL ב-`<StatsTallWidget>` ו-`<FiltersAndListWidget>` מיפו את 3 הערכים החדשים.

  **תקלות שעלו ושיטת העבודה:**
  - **Vercel webhook נתקע פעמיים** — אחרי merges ל-main לא הופעל deploy חדש לproduction (התקיעה הייתה ב-main, ה-preview של feature branch עבד). הפתרון: empty commit `chore: trigger Vercel redeploy`/`chore: trigger Vercel production redeploy` שמדחף webhook חדש. קומיטים: `d18d85d`, `aa16567`.
  - **שגיאת build ב-Vercel `tsc -b`** — `Meta` ו-`sourceLabel` נשארו לא-בשימוש ב-`RecordingPlayer.tsx` אחרי החלפתם ב-`SourceMeta`. `tsc --noEmit` הלוקאלי לא תפס (תקלה ידועה מ-#87) אבל Vercel עם `noUnusedLocals` נפל. fix ב-`c262da6` — מחיקת שניהם.
  - **MCP `pull_request_read` לא היה זמין** בסשן הזה (lockdown) — לכן merges נעשו דרך CLI git ו-deployments בוצעו ע"י Vercel auto-deploy על main.

  **קומיטים בסשן (כולם מוזגו ל-main):**
  ```
  d09e6e4 stats moved into FiltersAndListWidget
  4ba3759 editable source + chevrons on meta cells
  c262da6 fix unused Meta/sourceLabel after refactor
  aab590b single-toggle date-order
  0d24aa9 extend source enum + free-text other
  0918781 TopInfoPanel — combine 3 project banners
  c5766b7 mobile compact picker + player-first (superseded)
  eacf4e6 mobile restore stats+filters + compact action row
  00ec717 mobile flex layout instead of grid (final)
  ```

  **פתוח לסשן הבא:**
  - **המשתמשת ביקשה roadmap מ-פאזה 8 והלאה** — ראי תשובה בסשן עצמו (לא נשמרה כאן כי המבנה הקיים של ה-SPEC לא ממוספר בפאזות מעבר ל-7).
  - **calendar week view RTL** — נשאר תלוי בקומיט #136, לא נבדק מאז שה-build התייצב. אם המשתמשת תאמת — לעדכן/לבטל את ה-followup הישן.
  - **דף הקלטות מובייל** — אחרי `00ec717` המשתמשת אישרה "מושלם". סוגר את ה-followup מ-#137 על "הרסת לי את דף ההקלטות".

- **2026-05-02 — פאזה 8.1.1: הרחבת KPI עם progressive disclosure (לפני 8.2).**
  - **למה:** המשתמשת אמרה ש-4 ה-KPI של 8.1 לא מספיק מפורטים. במקום toggle compact/expanded
    גלובלי שהיא הציעה, בחרנו progressive disclosure פר-כרטיסיה — 6 hero cards שכל אחת
    נפתחת בקליק לסאב-מטריקס + השוואה לטווח הקודם. הסיבה: toggles גלובליים קובעים מצב
    "כל המידע / חלק מהמידע" שאף אחד לא משנה אחרי יום, ובינתיים יש מצב חצי-עמוס שגור
    שכמעט תמיד לא אופטימלי.
  - **6 הכרטיסיות (`src/components/dashboard/widgets/RangeKpis.tsx`):**
    1. **זמן עבודה** — total tracked. Expand: streak, שעת שיא, ימים פעילים, sparkline (week/month).
    2. **משימות שהושלמו** — count. Expand: חדשות שנוצרו, באיחור, ממוצע זמן לסיום, prev.
    3. **ביצוע %** — completed/scheduled. Expand: counts גולמיים + זמן פוקוס נטו (tracked − meetings).
    4. **פגישות** — count + שעות. Expand: ממוצע משך, % עם וידאו, prev.
    5. **הקלטות** — count + דקות. Expand: שעות סה"כ, breakdown לפי `source` enum (call/meeting/thought/other).
    6. **מחשבות** — count + שיעור עיבוד. Expand: מעובדות/סה"כ, breakdown לפי source (app_*/whatsapp_*).
  - כל hero card: trend chip (`↑/↓/—`) מול הטווח הקודם — `prev = shiftRange(range, view)`
    (יום אחורה / שבוע אחורה / חודש אחורה). פאנל נפתח עם `aria-expanded` וגריד 2-עמודות
    של sub-metrics.
  - **פטרן fetch:** טווח-איחוד (`min(prev.from, range.from)` → `max(prev.to, range.to)`)
    נשלח ל-`useEvents` ול-`useTimeEntriesByRange` כדי לחשב את שתי התקופות מאותו payload.
    Tasks/recordings/thoughts ממילא נטענים full-org-scope, אז סינון לטווח קורה ב-JS.
  - **layout:** `weekly_kpis` גדל ל-`h:7` בדסקטופ (היה 5) כדי לתת מקום ל-6 כרטיסיות
    ב-2×3 grid. `active_projects` הוגדל ל-`w:8` (היה 6) כדי למלא את החלל לצד KPI הגבוה,
    ו-`unprocessed_thoughts`/`notifications` ירדו בהתאם.
  - החלטות שעלו במהלך הבניה:
    - אין שדה `due_at` בפועל בטבלת `tasks` — ה-SPEC §15 הזכיר אותו אבל ה-DB יישם רק
      `scheduled_at`. **באיחור** מוגדר כאן `scheduled_at < now() AND !completed_at`
      בתוך הטווח. אם נוסיף `due_at` בעתיד — להחליף את התנאי ב-`computeStats`.
    - sparkline מוצג רק ב-`week`/`month` (ב-`day` יש רק נקודה אחת — חסר ערך).
    - מצב הפתיחה של כל כרטיסיה הוא **לוקאלי לקומפוננטה** (לא ב-`widget_state`) — preference
      רגעי, לא איזון לאחסון DB. אותו עיקרון כמו ה-collapse של `DashboardGrid`.


- **2026-05-02 — פאזה 8.2 + 8.3 (סשן ארוך): סיכום AI יומי/שבועי/חודשי + agent עם אישור פעולות.**

  ## פאזה 8.2 — Brief AI read-only

  **מטרה:** באנר עליון בדשבורד שמציג סיכום AI לטווח הנבחר (יום/שבוע/חודש) — מה
  היה, עם מי דיברתי, מתי הייתי הכי יעילה, והמלצות. בלי לבצע פעולות, רק טקסט.

  **רכיבים שנבנו:**
  - **migration `20260502000001_daily_briefs.sql`** — טבלת קאש לסיכומים. PK
    על `(user_id, organization_id, view, anchor)` כדי שכל טווח יישמר עם תוצאה
    אחת. עמודות 8.3 (`proposals`, `proposal_decisions`) שותלו מראש כדי
    שהמיגרציה תהיה forward-compatible. RLS פר-משתמש, service-role של ה-edge
    function עוקפת.
  - **edge function `supabase/functions/daily-brief/`** — בדומה ל-`summarize`:
    1. פולת מכל הטבלאות (tasks/events/recordings/thoughts/time_entries) את
       מה ששייך לטווח, ארוז כטקסט עברי קומפקטי עם entity ids מפורשות
       (`task:<uuid>`, `event:<uuid>`, `rec:<uuid>`, `thought:<uuid>`).
    2. שולחת ל-Claude Sonnet 4.6 עם tool-use (`report_brief`) ו-system prompt
       מטומון (`cache_control: ephemeral`).
    3. ולידציה של ה-proposals — רק ids שמופיעות בקלט עוברות.
    4. UPSERT לטבלת `daily_briefs` עם `onConflict: user_id,organization_id,view,anchor`.
    5. **קבלה של `from`/`to` כפרמטרים** — תיקון ל-TZ shift: ה-frontend ב-RTL Israel
       מחשב טווחים ב-local-tz, ה-edge function רץ UTC. בלי הפרמטרים האלה,
       `parseIsoDate('2026-05-02')` היה מחזיר UTC midnight ולא Israeli midnight.
       fallback ל-UTC interpretation אם `from`/`to` חסרים (לא אמור לקרות מ-UI).
  - **service `src/lib/services/daily-brief.ts`** — שלוש פונקציות: `loadCachedBrief`
    (קריאה מהטבלה ב-RLS פר-user), `generateBrief` (קריאה לפונקציה), ו-
    `recordProposalDecision` (read-modify-write על `proposal_decisions` jsonb).
  - **hook `src/lib/hooks/useDailyBrief.ts`** — `useDailyBrief({view, anchor})`
    לקריאה (cache-first), `useGenerateDailyBrief({view, anchor, from, to})`
    למוטציה (force=true ל-refresh ידני), ו-`useRecordProposalDecision()` עם
    optimistic update.
  - **widget `BriefBanner`** — חי בראש הדשבורד (`x:0,y:0,w:12,h:7`). מציג:
    - Headline + summary
    - "עם מי דיברת" — כרטיסיות פר-אדם (שם + הקשר)
    - "הקלטות" — דייג'סט של הקלטות התקופה
    - "שעות יעילות" — תובנה אחת
    - "המלצות" — 2-5 כרטיסיות מקובצות (time/tasks/meetings/general)
    - "הצעות פעולה" — כרטיסיות 8.3 (ראה למטה)
    - 4 מצבי UX: empty / loading / ready / error
    - כפתור "🔄 רענן" שולח `force:true` (קריאת AI חדשה ≈ ¢2-5)

  **עיצוב טוקנים:** השתמשתי ב-`from-violet-100 to-primary-100` ל-AI accent,
  טון `bg-emerald-50/100` להמלצות `tasks`, `bg-violet-50/100` לפגישות,
  `bg-primary-50/100` לזמן, `bg-amber-50/100` ל-general.

  **עלות:** Sonnet 4.6 — system prompt ~1500 tokens (cached, חוסך עד 90%),
  user context ~2.5K tokens (פר טווח), output ~600 tokens. ≈ ¢2-5 פר קריאה.
  ברירת מחדל **שמרני** — מאוחסן בקאש, רק `🔄 רענן` יוצר קריאה חדשה.

  ## פאזה 8.3 — Agent עם אישור פעולות

  **עקרון בסיס:** AI לא מבצע שום פעולה לבד. הוא מציע — המשתמשת מאשרת.

  **6 סוגי הצעות:** `move_task`, `schedule_task`, `create_event`, `reorder_day`,
  `complete_task`, `split_task`. כל הצעה: `{id, kind, payload, reason}` עם
  payload typed פר kind.

  **רכיבים שנבנו:**
  - **טיפוסים ב-`src/lib/types/domain.ts`** — `Proposal` discriminated union,
    `ProposalDecision` (state: 'approved'|'dismissed'|'edited' + applied_at +
    applied_target_id + edited_payload).
  - **edge function** — `report_brief` tool-schema כולל `proposals[]`. ולידציה
    אגרסיבית בצד שרת: כל `task_id`/`event_id`/`recording_id` חייב להופיע
    ב-`knownTaskIds`/`knownEventIds`/`knownRecordingIds` (Sets שנבנו מהקלט).
    הצעות לא תקינות מסוננות לפני ה-UPSERT. אם Claude ממציא id — נופל בשקט.
  - **`BriefProposalCard`** — כרטיסיה לכל הצעה עם 3 פעולות:
    - **✓ אישור** → קורא ל-mutation המתאימה (`useUpdateTask`/`useCompleteTask`/
      `useCreateEvent`/`useCreateTask` בהתאם ל-kind), ואז `recordDecision`
      עם `state:'approved'` + `applied_at` + `applied_target_id`.
    - **✕ דחייה** → רק `recordDecision` עם `state:'dismissed'`.
    - **✏ ערוך לפני** → פותח inline editor, המשתמשת מתקנת payload (תאריך,
      כותרת, מיקום, משך), אישור עם `state:'edited'` + `edited_payload`.
  - **inline editors** — תומכים ב-`move_task`, `schedule_task`, `create_event`.
    `reorder_day` ו-`split_task` רק approve/dismiss (post-MVP — מורכבים).
  - **history view** — אחרי החלטה הכרטיסיה הופכת ל-`DecisionRow` קומפקטי
    (ירוק/אפור) שמראה את הזמן והפעולה. כפתור "הראה טופלו" חושף דחיות.
  - **optimistic update** ב-`useRecordProposalDecision` — UI מתעדכן מיד,
    rollback אוטומטי אם DB נופל.

  **בעיות מוכרות שלא תוקנו (acceptable for MVP):**
  - **Race ב-approve מקביל** — `recordProposalDecision` עושה read-modify-write
    על `proposal_decisions` jsonb. אם לוחצים על 2 הצעות במקביל, הכתיבה
    האחרונה מוחקת את הראשונה. סבירות נמוכה (משתמש לוחץ אחד-אחד), השפעה
    קטנה (אפשר ללחוץ שוב). תיקון מתאים: RPC עם `jsonb_set`.
  - **`reorder_day`/`split_task` — אין עריכה** — רק approve/dismiss.
  - **TZ של ה-edge function** — אם ה-frontend לא שולח `from`/`to` (לא אמור
    לקרות מ-UI), נופל ל-UTC interpretation של anchor. נכון פר-API.

  ## דברים שלא הצלחתי לבדוק בלי דפדפן
  - **גלילה אופקית של הצעות** ב-mobile (חצים ימינה/שמאלה לכרטיסיות).
  - **התנהגות באמת של המודל** — האם Claude עוקב אחרי ה-prompt? יש סיכוי
    שיפיק הצעות עם ids שלא ראה. הוולידציה תסנן אותם, אבל המשתמשת תראה
    "0 הצעות" מסיבה לא ברורה. לוג ב-console יעזור לדבג.
  - **קומפילציה של ה-edge function ב-Supabase** — לא הרצתי `supabase
    functions deploy`. צריך לוודא שה-deno deps נפתרים (`std@0.224.0`,
    `@supabase/supabase-js@2.48.1`).

  **קומיטים:**
  - `feat(dashboard/8.2): AI brief banner with cache + manual refresh`
  - `feat(dashboard/8.3): proposal cards with approve/dismiss/edit`

  (שני הפיצ'רים מוזגו ל-main כדי שיתוופצו ב-Vercel.)

- **2026-05-02 (סוף יום) — פאזה 8.2.1: AI עם מבט קדימה (forward planning).**

  **טריגר:** המשתמשת ביקשה שהסיכום לא רק יסכם את העבר — שיציע **גם הצעות
  עתידיות**: סידור ימים קדימה, העברת משימות ביום עמוס, תזמון משימות פתוחות,
  המלצות יעילות לטווח הבא.

  **שינויים ב-edge function `daily-brief`:**
  - **חלון lookahead** — הפונקציה שולפת משימות/אירועים מעבר לסוף הטווח:
    day → 7 ימים קדימה, week → 28 ימים, month → 90 ימים. ה-ids נכנסים ל-
    `knownTaskIds`/`knownEventIds` כך שהצעות עליהם עוברות ולידציה.
  - **שלוש סקציות חדשות בקלט:**
    - `== הצפוי בקרוב ==` — משימות מתוזמנות קדימה, מקובצות לפי יום (כדי
      שה-AI יראה ימים עמוסים).
    - אירועים צפויים בלוח.
    - `== משימות פתוחות ללא תזמון ==` — משימות בלי `scheduled_at`,
      ממוינות לפי דחיפות (חומר ל-`schedule_task`).
  - **SYSTEM_PROMPT שודרג** — מסביר שהקלט מכיל שתי שכבות זמן (עבר + עתיד),
    דורש לפחות חצי מההמלצות יהיו עתידיות, מבקש להציע באקטיביות
    `move_task`/`schedule_task`/`reorder_day` עבור הצפוי בקרוב.
  - **שדה חדש `forward_outlook`** — פסקה מנדטורית של 2-3 משפטים על מה
    צפוי בתקופה הבאה ועל מה לשים דגש. נוסף ל-tool schema של Claude
    (`required`).
  - **קטגוריות recommendations הורחבו** — `efficiency` ו-`planning` נוספו
    ל-time/tasks/meetings/general (6 במקום 4). שני החדשים forward-looking.
  - **תקרת הצעות עלתה ל-8** (היה 6) — כדי שיהיה מקום גם לסיכום עבר וגם
    לתכנון עתיד.

  **שינויים ב-frontend:**
  - `BriefOutput.forward_outlook?: string` ב-`src/lib/types/domain.ts`.
    קטגוריות recommendations הורחבו ב-2.
  - `BriefBanner` מציג סקציה חדשה "מה צפוי קדימה" עם רקע gradient
    (indigo/cyan) כדי לבדל ויזואלית מסיכום העבר. CATEGORY_ICON +
    CATEGORY_TONE קיבלו `efficiency` (TrendingUp + cyan) ו-`planning`
    (CalendarDays + indigo).

  **deploy:** ה-edge function נפרס דרך MCP (version 2 על
  `rzlvuaqbvfzkunbyyvbc`). הקוד הזה תאם את ה-DB הקיים — אין מיגרציה חדשה.

  **הצעה נדחתה במכוון:** לא הוספתי שדה נפרד `schedule_suggestions` — הכל
  זורם דרך `proposals[]` הקיים (move_task/schedule_task/reorder_day הם
  בדיוק מה שצריך). עוד שדה היה כפילות.

  **קומיט:** `feat(dashboard/8.2.1): AI forward planning + lookahead window`

- **2026-05-03 — פאזה 8.3.1: ReorderDay כאג'נדה ויזואלית + Bulk Actions.**

  **טריגר:** ה-AI מציע פעולות, אבל ב-`reorder_day` הקלף הקיים פשוט הציג
  "לסדר מחדש N משימות" עם אישור גלובלי בלבד. המשתמשת ביקשה אג'נדה
  ויזואלית של היום המוצע + checkbox פר-משימה כדי לאשר/לדחות שינוי בודד.

  **שינויים — Frontend:**
  - **קומפוננטה חדשה `ReorderDayCard`** (`src/components/dashboard/widgets/
    BriefReorderDayCard.tsx`):
    - מקבץ את ה-moves לפי יום (יום שני / יום שלישי / ...) ומסדר לפי שעה.
    - לכל move: checkbox (default checked) + שם המשימה + diff "היה→יהיה"
      (ישן strikethrough, חדש בולט) + DateTimePicker inline לשינוי השעה.
    - כפתור "אשר את כל הסידור" / "אשר X מסומנות" (משתנה לפי בחירה),
      "סמן הכל / בטל הכל", "דחה הכל".
    - אם המשתמשת ביטלה checkbox או שינתה שעה — נרשם כ-`edited` עם
      `edited_payload` שמכיל רק את ה-moves הנבחרים.
  - `ApplyProposalCard` מנתב הצעות `reorder_day` ל-`ReorderDayCard` במקום
    הקלף הגנרי.

  **`ProposalsToolbar` (B-bulk actions ב-`BriefBanner.tsx`):**
  - מופיעה כשיש ≥2 הצעות פתוחות.
  - "אשר הכל (N)" — מאשר רק הצעות *פשוטות* (move_task / schedule_task /
    complete_task). הצעות מורכבות (reorder_day / split_task / create_event)
    דורשות אישור פרטני — מגן על המשתמשת מטעויות גדולות.
  - "דחה הכל (N)" — דוחה את כל הפתוחות.
  - שגיאה בודדת לא חוסמת את השאר; מציגה את השגיאה הראשונה.

  **תשתית bulk decisions:**
  - `recordProposalDecisionsBatch(briefId, decisions)` ב-service: עדכון
    אחד של `proposal_decisions` JSONB עם N החלטות בו-זמנית. מונע race
    בין read-modify-write.
  - `useRecordProposalDecisionsBatch` hook עם optimistic update.

  **שיפור visual diff ב-`move_task` / `schedule_task`:**
  - `move_task` summary: שם המשימה בשורה אחת, ומתחתיה "זמן ישן
    (strikethrough) ←חץ← זמן חדש (badge ירוק)".
  - `schedule_task`: זמן חדש כ-badge primary + משך זמן.

  **`ReorderDayPayload.moves` הורחב:**
  - נוספו `current_scheduled_at?: string | null` ו-`duration_minutes?:
    number | null` לכל move.
  - כולם optional — אם ה-AI לא מספק (גרסת v2 של ה-edge function), ה-UI
    מציג "ללא תזמון → X" וזה עובד.

  **שינויים — Edge Function (נפרס v4):**
  - SYSTEM_PROMPT הורחב עם סקציה "מבני payload" שמפרטת בדיוק אילו שדות
    ה-AI חייב למלא לכל סוג הצעה. דגש מפורש: ב-`reorder_day` חובה
    current_scheduled_at + task_title + duration_minutes לכל move.
  - הפריסה דרך MCP נכשלה בתחילה (ZodError) כי ה-project ID שב-MCP
    server היה stale; אחרי שהמשתמשת ריענן את ה-MCP ה-list_projects
    החזיר את ה-ID הנכון (`rzlvuaqbvfzkunbyyvbc`) והפריסה עברה
    ל-version 4. מעכשיו ה-AI ימלא את כל השדות החסרים בעצמו.

  **קומיט:** `feat(brief/8.3.1): visual reorder-day agenda + bulk actions`

- **2026-05-03 — מסך משימות, גל 1: שיפורי UX קטנים בכל המסך.**

  **טריגר:** המשתמשת ביקשה 5 שינויים תחומים שמרגישים "קטנים" כל אחד
  בנפרד אבל בצירוף משנים את ההרגשה של עבודה במסך.

  **A. ברירת מחדל לדחיפות 3 → 0.** משימה חדשה כברירת מחדל לא מקבלת
  דירוג בכלל; המשתמשת בוחרת אם בכלל לדרג. תוקן בכל מקומות היצירה:
  `TaskRow` (Enter יוצר sibling, Tab/Add subtask), `TaskColumn`
  (handleCreate / handleEmptyCreate), `UnassignedBanner` (handleCreate),
  `TaskEditModal` (createDraft fallback), `QuickCapture` (משימה חדשה).
  הצעות AI ב-`thought-suggestions` נשארו עם 3 כי שם זה הצעה
  קונקרטית-משמעית של ה-AI, לא ברירת מחדל.

  **B. תפריט הקשרי על שורת משימה — z-index בעיה.** התפריט (עפרון/חץ/
  שכפל/מחק) היה `position: absolute` ביחס ל-row, ולכן נחתך מתחת
  לכרטיס הרשימה כשנשמרה גלילה פנימית. תוקן ב-`TaskRow.tsx`:
  - `createPortal` ל-`document.body` עם `z-[61]` ו-backdrop ב-`z-[60]`.
  - מחושב מיקום הכפתור עם `getBoundingClientRect()` ב-`openMenu()` —
    `top = bottom + 4`, `right = window.innerWidth - rect.right`
    (RTL-friendly, נצמד ל-end של הכפתור).
  - listener ל-`scroll` capture-phase + `resize` סוגרים את התפריט
    (כי המיקום קפוא ולא יכול לעקוב אחרי גלילה).
  - `closeMenu()` מאחד ניקוי של `menuOpen` + `duplicateToListOpen`
    כדי שתת-תפריט "שכפל לרשימה אחרת" לא יישאר תקוע.

  **C. "לא משויכות" סגור — אופקי במקום אנכי במצב ערימה.** ב-Stack
  layout הברנר היה ניסה להפוך לרצועה אנכית צרה (vertical strip עם
  text writing-mode). זה התאים ל-Columns אבל נראה רע ב-Stack. תוקן
  ב-`UnassignedBanner.tsx`: כש-`fullWidth=true` מציגים תמיד את ה-bar
  האופקי הצר (Inbox + שם + ספירה + ChevronDown), בלי קשר ל-mobile/
  desktop. בColumns עדיין vertical strip בדסקטופ.

  **D. Sticky banners בStack layout.** בStack המשתמשת ביקשה ש"באנר
  עליון, סרגל ולא-משויכות יישארו בעין כל הזמן, רק רשימות יגללו".
  ארגנתי מחדש את `Tasks.tsx`: ה-`DndContext` עכשיו עוטף את כל החלקים
  (כך drop targets ב-toolbar+banner נשמרים), וב-Stack-mode בלבד —
  עוטפים את `TasksChrome` + `FilterBar` + `StatsPanel` + `Unassigned`
  ב-`<div className="sticky top-0 z-30 bg-ink-50 ...">`. רשימות
  ה-`TaskColumn` יורדות אחרי. בColumns mode המבנה נשאר זהה.

  **E. Hover highlight על שורת משימה.** המשתמשת התלוננה ש"כשהשורות
  ארוכות אני מתבלבלת ועורכת משימה אחרת". הוספתי `hover:bg-ink-50`
  ל-className של `TaskRow` — צבע בהיר אך מובחן שמדגיש על איזו שורה
  המצביע נמצא.

  **בא בהמשך:** גל 2 (drag/swap subtasks + multi-select bulk),
  גל 3 (undo/redo audit מלא — יצירה/מחיקה/כותרת/תיאור/תזמון),
  גל 4 (`deadline_at` column + UI — דד-ליין נפרד מ-scheduled_at).

  **קומיט:** `feat(tasks): wave 1 — urgency default, portal menu, sticky stack, hover, unattached fix`

- **2026-05-03 — מסך משימות, גל 2: drag חכם + multi-select bulk.**

  **טריגר:** המשתמשת ביקשה (1) drag שמבדיל בין reorder לבין nest בלי
  shift או כפתורים מיוחדים, ו-(2) יכולת לסמן כמה משימות בבת אחת
  ולהפעיל פעולות עליהן ביחד.

  **2.1 — Three-zone drag.** במקום droppable יחיד שתמיד עושה nest,
  כל TaskRow עכשיו חולק לשלושה אזורי-הצבה:
  - 25% עליון → drop **לפני** השורה (sibling above) — קו 2px primary
    בקצה העליון של השורה כאינדיקטור
  - 50% אמצעי → **תת-משימה** של השורה (nest) — bg-primary-50 + ring
    סביב כל השורה
  - 25% תחתון → drop **אחרי** השורה (sibling below) — קו תחתון

  שלושה droppables נפרדים (`task-before:` / `task-nest:` / `task-after:`)
  עם 3 absolute strips (pointer-events:none כדי לא לחסום קליקים).
  `handleDragEnd` ב-Tasks.tsx מטפל בכל סוג: nest כמו קודם
  (`setParent`/`moveToList`), ו-before/after מחשבים sort_order חדש
  כ-midpoint בין השכן לפני/אחרי הtarget. ה-double-precision של ה-DB
  לעמודה מאפשר אלפי midpoints בלי overflow. כולם עטופים ב-`pushUndo`
  כך ש-Ctrl+Z מחזיר גם list, גם parent, וגם sort_order.

  **2.2 — Selection store.** Zustand store חדש ב-`src/lib/selection/
  store.ts` עם `selected: Set<string>`, `anchorId`, ו-`orderedIds`.
  פעולות: `toggle`, `selectOnly`, `shiftSelect` (אם יש anchor — בוחר
  את כל ה-IDs ברנגה לפי orderedIds), ו-`clear`. ה-`orderedIds` מנופצף
  ב-Tasks.tsx מתוך `listTrees` בסדר התצוגתי (Unassigned → לפי
  visibleLists → depth-first בכל list) ומועבר ל-store ב-useEffect.
  Esc מנקה בחירה (window listener).

  ב-TaskRow נוסף checkbox קטן ב-leading edge של השורה — שקוף עד
  hover, רואים אותו מלא כשהשורה נבחרת. Click=toggle, Shift+click=
  range. שורה נבחרת מקבלת `bg-primary-50/60 ring-1 ring-primary-300`.

  **2.3 — BulkActionsToolbar (חדש).** סרגל קבוע בתחתית המסך שמופיע
  כשיש ≥1 בחירה. מציג ספירה + פעולות: דחיפות (אותו popup של 0/1/2/3
  כמו row UrgencyChip), תזמון (datetime-local + "הסר תזמון"),
  העברה לרשימה (rendezvous עם רשימת כל הרשימות + "לא משויכת"),
  סימון הושלם, ומחיקה (עם confirmation modal). כפתור X מנקה בחירה.
  כל פעולה batch-mutate עם `Promise.all` לוגי (parallel `mutate()`
  calls), ועטופה ב-`pushUndo` יחיד עם `description` שכולל את הספירה
  (למשל "שינוי דחיפות (5)"). ה-undo משמור snapshot map id→prev value
  לכל משימה כדי להחזיר כל אחת ל-state המקורי שלה.

  Complete ו-Delete מנקים את הבחירה אחרי ביצוע (ההמשך של עבודה על
  אותן משימות לא הגיוני). שאר הפעולות שומרות את הבחירה.

  **קומיט:** `feat(tasks): wave 2 — three-zone drag + multi-select with bulk toolbar`

- **2026-05-03 — מסך משימות, גל 3: undo/redo coverage מלא.**

  **טריגר:** המשתמשת דיווחה ש-undo "לא עובד בכל הפעולות, למשל בכתיבה
  או במחיקה או בעריכה". עד עכשיו ה-`pushUndo` עטף רק urgency,
  indent/outdent, complete, drag/reorder, ושינויי רשימה. כל הפעולות
  המוכרות שלא נכללו: יצירת משימה (Enter sibling, Tab subtask, +N),
  שינוי כותרת inline (commitTitle), שמירה ב-TaskEditModal (כל
  השדות), מחיקה (כולל subtree).

  **3.A — Create + title + delete:**
  - **Create** עטוף ב-3 מקומות: `TaskRow.handleKeyDown` (Enter יוצר
    sibling), `TaskRow.handleAddSubtask`, `TaskColumn.handleCreate`/
    `handleEmptyCreate`, ו-`UnassignedBanner.handleCreate`.
    ה-`pushUndo`: `undo: deleteTask(newId)`, `redo: createTask(payload)`.
    Note: ב-redo נוצר id חדש אם המשתמשת undo+redo, אבל ה-payload
    זהה — pragmatic trade-off לעומת preserving id.
  - **Title** ב-`commitTitle`: snapshot של `task.title` לפני updateTask,
    `pushUndo` עם undo/redo של ה-title הקודם/חדש.
  - **Delete** ב-`TaskRow.handleDelete`: לפני ה-deleteTask, קוראים
    ל-`tasksService.fetchTaskSubtree(rootId)` שמחזיר את כל ה-subtree
    (root + descendants ב-BFS, parent-first). אחרי ה-delete, ה-undo
    קורא ל-`useRestoreTasks` שmutates `tasksService.restoreTasks` —
    insert חזרה של כל ה-rows עם ה-ids המקוריים בסדר parent-first.
    ה-DB מאפשר insert עם id מפורש, וה-FK של parent_task_id מוצמדת
    ב-deferrable mode כך שגם אם ילדים נוצרים לפני parents הכל עובד.
    ה-description של ה-undo משלב את ספירת ה-subtree אם > 1 ("מחיקת
    משימה (5 פריטים)").

  **3.B — TaskEditModal save:**
  - ב-create mode: אותה תבנית כמו 3.A — `pushUndo` עם delete/recreate.
  - ב-update mode: snapshot של **כל** השדות הניתנים לעריכה (title,
    description, notes, urgency, status, task_list_id, assignee_user_id,
    tags, location, external_url, scheduled_at, duration_minutes,
    estimated_hours, is_phase) לפני ה-mutateAsync, אז `pushUndo` עם
    undo=updateTask(prevPatch), redo=updateTask(newPatch). פעולה
    אחת של Ctrl+Z מחזירה את כל הטופס למצב הקודם.

  **תשתית חדשה:**
  - `tasksService.fetchTaskSubtree(rootId): Promise<Task[]>` — BFS
    על parent_task_id, מחזיר flat array.
  - `tasksService.restoreTasks(tasks: Task[]): Promise<void>` —
    insert ברצף (אחד-אחד כדי לשמור על סדר), כולל id מפורש.
  - `useRestoreTasks()` hook — mutation שמ-invalidates את ה-tasks
    query אחרי ה-restore כדי שה-React Query cache יתעדכן.

  **לא נכלל בכוונה:** undo על duplicate, indent רב-שלבי, ו-changes ב-list metadata
  (rename/color/emoji/pin) שכבר היה להם undo. גם undo על
  bulk-actions toolbar כבר קיים (מגל 2).

  **קומיט:** `feat(tasks): wave 3 — undo coverage for create/title/edit/delete`

- **2026-05-03 — מסך משימות, גל 4: דד-ליין נפרד מ-scheduled_at.**

  **טריגר:** המשתמשת ביקשה שדה דד-ליין על משימה — נפרד מ-scheduled_at:
  > "למשימה יש כרגע תזמון, זה מראה לי מתי אני רוצה לעבוד עליה,
  >  בנוסף צריך שכל משימה יהיה אפשר לערוך לה גם דד-ליין. שזה לא
  >  הזמן שאני בהכרח עובדת עליה אבל זה הזמן האחרון לביצוע."

  **4.A — DB migration:** `ALTER TABLE tasks ADD COLUMN deadline_at
  TIMESTAMP WITH TIME ZONE` + `tasks_deadline_at_idx` (partial index
  על deadline_at IS NOT NULL AND completed_at IS NULL — מאיץ
  את ה-"מה חורג" של הדשבורד).

  **4.B — Types:** הוספת `deadline_at: string | null` ב-Row/Insert/
  Update של `database.ts`. ה-`Task = Tables["tasks"]["Row"]` ב-
  domain.ts מקבל את זה אוטומטית.

  **4.C — TaskEditModal:** שדה חדש "דד-ליין" עם DateTimePicker בטאב
  "תזמון". תוויות תוקנו: "תאריך ושעה" → "זמן עבודה מתוכנן" עם hint
  "מתי את מתכננת לעבוד עליה". דד-ליין עם hint "הזמן האחרון
  לביצוע — שונה מהזמן המתוכנן". ה-`Field` רכיב הורחב לתמוך ב-
  `hint?: string` (שורת טקסט קטנה ind ink-400 מתחת לשדה).
  ה-`saveAll` מטפל בfield החדש ב-create + update + ב-snapshot של
  ה-undo (גל 3 מחזיר את כל ה-deadline בנוסף לכל שאר השדות).

  **4.D — Badge ב-TaskRow:** badge נפרד שמוצג תמיד כשיש deadline +
  לא הושלם. צבע לפי דחיפות הזמן:
  - **אדום** (`bg-danger-50 text-danger-700`) — דד-ליין עבר.
  - **כתום** (`bg-warning-50 text-warning-700`) — דד-ליין תוך 24
    שעות.
  - **ניטרלי** — מעבר לכך.
  אייקון `AlertTriangle`. ב-mobile menu (פרטי השורה ב-⋯) — שורה
  נפרדת "דד-ליין" עם הזמן. ה-`scheduled_at` badge עכשיו עם title
  "זמן עבודה מתוכנן" במקום "תאריך יעד" (שלא היה מדויק).

  **4.E — Edge function v7:** ה-context של ה-AI עכשיו מציג
  `⏳דד-ליין:DD/M HH:MM` ליד כל משימה שיש לה. SYSTEM_PROMPT מסביר
  את ההפרדה: scheduled_at ניתן להזיז, deadline_at קדוש — אסור
  לדחוף scheduled_at אחרי deadline. משימה עם דד-ליין לא מתוזמנת —
  חובה להציע schedule_task לפני הדד-ליין.

  **קומיט:** `feat(tasks): wave 4 — deadline_at column + UI + AI awareness`

- **2026-05-03 — מסך משימות, גל 5+6: drag/select cascade + סדר רשימות.**

  **טריגר:** המשתמשת דיווחה על שני באגים בגל 2/3 ובקשה אחרונה:
  > "1. כשאני מעבירה משימה עם תתי משימות, תתי המשימות שלה לא
  >  עוברים איתה - הם צריכים אוטומטית לעבור איתה.
  >  2. כשאני מסמנת משימה תתי המשימות שלה צריכות להיות מסומנות
  >  אוטומטית ואפשר לבטל את הסימון."
  > "צריך להיות יכולת עריכה של איזה רשימה אני רואה קודם כאילו את
  >  סדר הרשימות, ממליצה שזה יהיה בסינון הרשימות"

  **5.A — drag cascade.** ב-`Tasks.tsx` נוספה helper `collectDescendants`
  (BFS על `tasks` המקומי). בכל אחד משלושת ה-handlers של drag (drop on
  list, task-nest, task-before/after), כשה-list משתנה אנחנו מחשבים את
  ה-descendant ids לפני ה-mutation, ואז קוראים ל-`moveToList` גם על
  המשימה הראשית וגם על כל descendant. ב-undo/redo — אותו loop, רק
  עם prev/next listId. ה-parent links עצמם **לא** משתנים — רק
  ה-`task_list_id` cascading. תתי-משימה נשארות ילדות של אבא שלהן,
  פשוט באותה רשימה כמוהו.

  **5.B — select cascade.** ב-`useTaskSelectionStore` נוסף
  `toggleSubtree(rootId, descendantIds)` — מחליט direction לפי root:
  אם השורש כרגע נבחר → מבטל את כל ה-subtree, אחרת מסמן את כולו.
  ב-`TaskRow.handleSelectClick` אם לשורה יש children, קוראים ל-
  `toggleSubtree(task.id, collectDescendantIds(children))`. ל-leaf
  ממשיכים עם ה-`toggle` הרגיל. ה-helper `collectDescendantIds` הוא
  flat depth-first של כל ה-descendants ב-`TaskTreeNode`. Shift+click
  עדיין עובד כרגיל (range select לפי orderedIds).

  **6 — סדר רשימות.** ב-popover "רשימות בתצוגה" של `TasksChrome`
  נוספו חצי ↑/↓ בצד כל שורה (מופיעים ב-hover על השורה). לחיצה
  קוראת ל-`onMoveListInOrder(listId, direction)` שעובר ל-`Tasks.tsx`.
  הלוגיקה ב-`handleMoveListInOrder`:
  - מצמיד את ה-list ל-peer group שלו (pinned-first / unpinned),
    כי ה-visual order משלב אותם.
  - מוצא את השכן הסמוך ואת השכן-של-השכן באותו כיוון.
  - מחשב `sort_order` חדש כ-midpoint בין השכנים (או ±1 אם
    בקצה). העמודה `sort_order` היא double-precision כך שיש מקום
    אינסופי בין כל שני ערכים.
  - קורא ל-`useReorderTaskLists.mutate([{id, sort_order}])` הקיים.
  - עוטף ב-`pushUndo` כך ש-Ctrl+Z מחזיר את הסדר.

  **קומיט:** `feat(tasks): wave 5+6 — drag/select cascade to subtasks + list reorder`

- **2026-05-03 — מסך משימות, גל 7: בקרת רשימה ישירה על הבאנר.**

  **טריגר:** המשתמשת ביקשה שלוש בקרות "מהירות" על הבאנר של כל
  רשימה — דברים שהיו דורשים תפריט-משנה או popover אחר:

  > 1. עינית כיסוי בצד שמאל של הבאנר (להסתיר את הרשימה).
  > 2. עיגול צבע ליד העינית (לערוך כמו עם האייקון).
  > 3. חצים למעלה/למטה (או ימינה/שמאלה ב-columns) להזיז סדר.

  **שינוי ב-`TaskColumn`:**
  - הוספת props: `onHide`, `onMoveInOrder(direction: -1 | 1)`,
    `isFirst`, `isLast`, `layout: "stack" | "columns"`.
  - בהדר, ב-end (אחרי שם + ספירה + Pin) נוספו ארבעה כפתורים:
    1. **חץ ↑ / →** — `onMoveInOrder(-1)` (move earlier). Disabled
       ב-`isFirst`. ב-RTL columns, ChevronRight = "מוקדם יותר" (סוף
       הflex = ימין הויזואלי = ה-leading edge).
    2. **חץ ↓ / ←** — `onMoveInOrder(1)`. Disabled ב-`isLast`.
    3. **עיגול צבע** — `w-4 h-4 rounded-full` עם `backgroundColor:
       listColor`. onClick → פותח את אותו color picker שכבר היה
       מתחת ל-menu item "שנה צבע כותרת" (מנפנף את ה-`colorOpen`
       state הקיים).
    4. **EyeOff** — `onHide()`. עוטף את `toggleListVisibility(id)`
       ב-Tasks.tsx.

  **חיבור ב-`Tasks.tsx`:** ב-stack mode + columns mode, כל
  `TaskColumn` מקבל את ה-handlers + flags. ה-pseudo-list "לא משויכות"
  לא מקבלת `onHide` (כי אין list_id) — הכפתור פשוט לא נרנדר. יוצא
  שגם ב-stack וגם ב-columns אותם 4 הכפתורים על הבאנר, רק כיוון
  החצים שונה.

  **קומיט:** `feat(tasks): wave 7 — quick controls on list banner (hide/color/reorder)`
