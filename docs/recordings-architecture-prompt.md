# פרומט — ארכיטקטורת הקלטות + Cloudflare R2

> תקציר עצמאי של ההחלטות שנקבעו בצ'אטים הקודמים על אחסון הקלטות.
> מתאים להעתקה כהודעה ראשונה בצ'אט חדש שמיועד **רק לבניית
> תשתית ההקלטות** (פאזה 6א).

---

## הבעיה
אפליקציית Multitask מקליטה אודיו (עד שעה+) מתוך הדפדפן ומ-WhatsApp. צריך אחסון שעומד בתנאים:
- **לא מאבד הקלטה** גם אם ה-tab קורס באמצע, גם אם הרשת נחתכת.
- **עלות נמוכה** גם בקנה מידה של אלפי שעות בחודש.
- **בלי לחשוף סודות** של ספק האחסון בדפדפן (כל `VITE_*` נטמע ב-bundle הציבורי).

## ההחלטות שנקבעו

### 1. ספק = Cloudflare R2
- egress חינם (S3 גובה על כל הורדה — קטסטרופה לאודיו).
- S3-compatible API (`@aws-sdk/client-s3` עובד as-is).
- מחליף את Supabase Storage שתוכנן בהתחלה.

### 2. Adapter pattern דו-שכבתי
```
Browser  ──HTTP──►  Supabase Edge Function  ──AWS S3 SDK──►  Cloudflare R2
                       (מחזיק R2_SECRET,
                        חי ב-Supabase secrets)
```

- **Edge Function (Deno)** מחזיק את ה-AWS SDK + הסודות.
- **דפדפן** = thin client; רק קורא ל-Edge Function endpoints. **בלי SDK של AWS בקוד הדפדפן.**

### 3. Endpoints של ה-Edge Function
- `POST /presign-upload` — presigned PUT לקובץ קצר (< 5MB).
- `POST /presign-multipart` — `CreateMultipartUpload` → מחזיר `uploadId` + presigned URLs לכל ה-parts.
- `POST /complete-multipart` — `CompleteMultipartUpload` עם רשימת ETags.
- `POST /abort-multipart` — `AbortMultipartUpload` בעת ביטול.
- כל endpoint מאמת JWT של Supabase ומוודא חברות פעילה בארגון.

### 4. הקלטות ארוכות = multipart מההתחלה
- **לא** מחכים ל-stop כדי להעלות. **כל chunk** של ~5MB / ~2 דק' (מה שקורה קודם) נשלח ישירות ל-R2 עם ה-presigned URL שלו.
- R2 מחזיר `ETag` לכל chunk → שומרים ל-`CompleteMultipartUpload` בסוף.
- ההקלטה עצמה (`MediaRecorder`) לא יודעת שיש העלאה ברקע. `XHR.upload.onprogress` נותן progress.

### 5. IndexedDB persistence
- כל chunk נכתב ל-IndexedDB **לפני** ההעלאה.
- ה-row נמחק רק אחרי ack מ-R2 (ETag חזר).
- Tab crash / רענון → טעינה הבאה משחזרת את ה-multipart הפתוח ומשלימה.
- **אין איבוד הקלטה גם אחרי שעה.**

### 6. ביטול = ניקוי דו-צדדי
- Browser → Edge Function: `AbortMultipartUpload`.
- Edge Function → R2: cleanup של ה-parts הפתוחים.
- Browser: ניקוי IndexedDB.

### 7. Cron לניקוי multiparts נטושים
- Edge Function נוספת שרצה פעם ביום.
- מבצעת `AbortMultipartUpload` לכל multipart שפתוח > 24 שעות.
- מטפלת ב-edge case של crash שלא הספיק לקרוא ל-abort.

## חוקי אבטחה (חוצי-פרויקט)

> זה התעדכן ל-§28 #9 ב-SPEC.md אחרי הדיון.

- **לעולם לא `VITE_*` עם סוד.** כל env var עם `VITE_` נטמע ב-bundle הציבורי.
- כל ה-secrets חיים ב-**Supabase secrets** (Dashboard → Project Settings → Edge Functions → Secrets).
- הדפדפן מקבל **presigned URLs קצרי-טווח** או JWTs חד-פעמיים, לעולם לא את הסוד עצמו.
- אותו עיקרון חל גם על `ANTHROPIC_API_KEY` (ל-Claude), `GLADIA_API_KEY` (לתמלול), וכל ספק חיצוני אחר.

## משתני סביבה — מי איפה

| משתנה | איפה | למה |
|-------|------|-----|
| `VITE_R2_PUBLIC_URL` | `.env` של הדפדפן (`VITE_*` OK) | ה-public URL של ה-bucket — לא סוד |
| `R2_ACCOUNT_ID` | Supabase secrets | Edge Function בלבד |
| `R2_ACCESS_KEY_ID` | Supabase secrets | Edge Function בלבד |
| `R2_SECRET_ACCESS_KEY` | Supabase secrets | Edge Function בלבד |
| `R2_BUCKET_NAME` | Supabase secrets | Edge Function בלבד |

## הגדרות bucket (ב-Cloudflare Dashboard, לא בקוד)

- **CORS:**
  - `AllowedOrigins` = production domain + `localhost:5173`
  - `AllowedMethods` = `PUT`, `POST`, `GET`, `HEAD`
  - `AllowedHeaders` = `*`
  - `ExposeHeaders` חייב לכלול `ETag` (אחרת multipart נשבר).
- **Public Bucket = OFF.** הקלטות פרטיות דרך presigned-GET (תוקף שעה).
  אם המשתמש משתף הקלטה מפורשות → אז public URL.

## שינויי סכמה ב-`recordings`

| עמודה | סוג | הערה |
|-------|-----|------|
| `storage_key` | text | object key יחסי ל-bucket (לא נתיב file-system) |
| `storage_provider` | enum (`r2` \| `supabase`) | default `r2`; `supabase` שמור למיגרציה היסטורית |
| `multipart_upload_id` | text \| null | שונה מ-NULL רק בזמן הקלטה פעילה |
| `status` | enum + ערך חדש `recording` | `recording` = לפני שהקובץ נסגר; `uploaded` = ב-R2 מוכן לתמלול |

## מה משתמש קצה עושה (≈ 15 דקות, חד-פעמי)

1. פותח חשבון ב-Cloudflare → R2 → יוצר bucket בשם `multitask-recordings`.
2. יוצר API token עם הרשאות לקריאה/כתיבה לאותו bucket.
3. מגדיר CORS על ה-bucket (כמתואר למעלה).
4. נכנס ל-Supabase Dashboard → Project Settings → Edge Functions → Secrets, מוסיף את 4 ה-secrets.
5. בקובץ `.env` של הפרויקט מוסיף `VITE_R2_PUBLIC_URL=...`.

## מה הסוכן בונה (הצד הטכני)

1. `supabase/functions/storage/index.ts` — Edge Function עם 4 endpoints + JWT verification.
2. `supabase/functions/_shared/r2-client.ts` — wrapper דק סביב ה-AWS SDK.
3. `src/lib/services/storage.ts` — thin client בדפדפן שקורא ל-Edge Function.
4. `src/lib/hooks/useFileUpload.ts` — hook עם progress, cancel, retry, ושחזור multipart פתוח מ-IndexedDB.
5. `src/lib/storage/indexeddb-chunks.ts` — שכבת persistence ל-chunks.
6. מיגרציה: 4 שינויים ב-`recordings` (כמתואר למעלה).
7. `supabase/functions/cron-cleanup-multiparts/index.ts` — cron יומי.

## מה אסור / לא לעשות

- **לא להוסיף `@aws-sdk/*`** ל-`package.json` של הדפדפן. זה נכנס רק ל-`supabase/functions/_shared/`.
- **לא להפעיל `Public Bucket = ON`.** קבצים פרטיים תמיד דרך presigned.
- **לא לתעדף "פתרון פשוט יותר"** כמו base64-ב-DB או Supabase Storage. ההחלטות למעלה מבוססות על תרחיש הקלטות שעה+ ועלות egress; "פשוט יותר" יישבר בסקייל.
- **לא לעקוף את ה-Edge Function** ולהזמין את הדפדפן לדבר ישירות עם R2 דרך SDK. זה מחייב חשיפת secret = פירצה.

## מקורות

- `SPEC.md` — Changelog entry "2026-04-24 — החלטת ארכיטקטורה — אחסון קבצים" + §28 #9.
- `SPEC.md` §18 — מסך הקלטות (עיצוב UI, יישום אחר כך בפאזה 6ב).
- `docs/phase-6-prompt.md` — הפרומט הכללי לפאזה 6 (שמשלב את 6א + 6ב + 6ג).
