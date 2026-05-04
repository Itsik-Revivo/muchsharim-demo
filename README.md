# מוכשרים – Demo Server

API מלא עם SQLite מובנה, מוכן לפריסה ב-Railway תוך 5 דקות.

## משתמשי הדמו
| שם | אימייל | הרשאה |
|----|--------|--------|
| עמית ברק | `admin@demo.com` | **Admin** |
| ישראל ישראלי | `israel@demo.com` | עובד |
| דנה כהן | `dana@demo.com` | עובד |
| יוסי גולן | `yosi@demo.com` | עובד |
| רחל אברהם | `rachel@demo.com` | עובד |
| מיכל שרון | `michal@demo.com` | עובד |

---

## פריסה ב-Railway (5 דקות)

### 1. העלה ל-GitHub
```bash
git init
git add .
git commit -m "Muchsharim demo"
gh repo create muchsharim-demo --public --push
# או: git remote add origin https://github.com/YOUR_USER/muchsharim-demo.git && git push -u origin main
```

### 2. פרוס ב-Railway
1. היכנס ל-[railway.app](https://railway.app) עם חשבון GitHub
2. לחץ **"New Project"** → **"Deploy from GitHub repo"**
3. בחר את ה-repo `muchsharim-demo`
4. Railway יזהה אוטומטית Node.js ויפרוס

### 3. קבל URL
Railway ייצור URL כמו:
```
https://muchsharim-demo-production.up.railway.app
```

פתח אותו בדפדפן ← תראה את ה-API Playground המובנה.

---

## הרצה מקומית
```bash
npm install
npm start
# → http://localhost:3000
```

---

## API Reference
כל ה-endpoints זמינים ב-Playground המובנה.
לקבל טוקן ידנית:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com"}'
```
