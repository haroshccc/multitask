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

1. Design tokens מ־`design-language.html`
2. Types משותפים
3. Supabase schema + RLS + Realtime + seeds
4. Services + React Query hooks
5. Layout בסיסי (Topbar + Sidebar + Routing)
6. **DashboardGrid infrastructure** (רוחבי)
7. **FilterBar infrastructure** (רוחבי)
8. **Lists Banner** (רוחבי למשימות/יומן/Gantt)
9. מסך משימות
10. מסך יומן
11. מסך Gantt
12. מסך הקלטות
13. מסך מחשבות
14. מסך פרויקטים / תמחור
15. מסך דשבורד הבית
16. הגדרות + Admin
17. Landing אינטראקטיבי

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
1. Client:   GET signed upload URL מ-Supabase Storage
2. Client:   העלאה ישירה ל-bucket 'recordings'
3. Client:   POST /recordings/:id/process
4. EdgeFn:   שולח URL ל-Gladia עם webhook callback
5. Client:   רואה status "מתמלל..." דרך Realtime
6. Gladia:   webhook מחזיר transcript + speakers + timestamps
7. EdgeFn:   Claude Haiku → {summary, my_tasks, their_tasks, speakers_hint}
8. DB:       נשמר, Realtime מעדכן UI
9. User:     רואה recording ready, מתייג "זה אני / זה דני לקוח"
10. On tag:  משימות משויכות לדוברים הנכונים, נכנסות ל-tasks
```

### דוברים
- **לא מגבילים ב-API.** הגבלה = פגיעה באיכות (המודל כופה איחוד).
- ב-UI: אם זוהו יותר מ-5 → אזהרה "זוהו N דוברים, אפשר לאחד ידנית".
- כלי UI: "Speaker 3 ו-Speaker 5 הם אותו אדם" → לחיצה אחת מאחדת.

### מגבלות קלט
| פרמטר | ערך |
|-------|-----|
| פורמט | MP3 בלבד (לא וידיאו) |
| מקסימום אורך | 3 שעות קשיח |
| רמז UI מעל 90 דק' | "הקלטה ארוכה — תמלול עשוי לקחת 5-10 דקות" (לא חוסם) |

### Retention ואחסון
| Source | ברירת מחדל | הערה |
|--------|-----------|------|
| `thought` | 60 יום לאודיו | טקסט/משימות/סיכום נשארים לנצח |
| `call` / `meeting` | לעולם | |
| `other` | לעולם | |

- המשתמש יכול לדרוס ברירת מחדל **פר הקלטה** או בהגדרות.
- Supabase Cron יומי: `DELETE audio WHERE now() > archive_audio_at` — רק האודיו נמחק, מטא־דאטה נשמר.

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

### יצירת אירוע — modal
אותו modal שמשמש במסך משימות, רק פתוח על tab "אירוע":
- כותרת · תיאור · מיקום · תאריך/שעה · משך · all-day.
- מוזמנים (autocomplete מתוך ארגון).
- שדה "לינק וידאו" + כפתור "🎥 צור Meet אוטומטית" (ראה §9).
- שיוך לפרויקט / רשימה / הקלטה מקור.
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
  storage_path, size_bytes, duration_seconds,
  status enum ('uploaded'|'transcribing'|'extracting'|'ready'|'error'),
  transcript_text, transcript_json,         -- עם timestamps + speakers
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
7. **Adapter pattern לאינטגרציות** — Gladia / Google / WhatsApp / OneSignal כולם מאחורי interface. החלפה = יום.
8. **אין מחיקה של tasks/recordings/projects** — רק ארכיון 60 יום → מחיקה אוטומטית ב-cron.

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








