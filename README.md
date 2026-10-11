# Crop Advisor – offline crop recommendation app

Same ML project as your Streamlit version (Random Forest, 100 trees, 22 crops, 7 inputs),
but it runs **entirely on the device** – no Python server – so one codebase works as:

1. a website on laptop/phone (open `www/index.html` or host the `www/` folder),
2. an installable PWA (Chrome/Edge "Install app"),
3. an Android **APK** (via Capacitor).

The model in `www/model.js` was exported from your `crop_model.pkl`; predictions match
scikit-learn exactly on all 2,200 dataset rows (0 mismatches).

## Project layout
```
www/            the app (index.html, app.js, engine.js, model.js, PWA files, icons)
tools/export_model.py   re-export model.js if you retrain crop_model.pkl
capacitor.config.json, package.json   Android wrapper
.github/workflows/build-apk.yml       builds the APK in the cloud
```

## Run on laptop (quickest)
Double-click `www/index.html`, or: `npm install` then `npm run serve` → http://localhost:8080

## Get the APK – Option A: GitHub (no Android Studio needed)
1. Create a GitHub repo and push this folder.
2. Go to **Actions → Build Android APK → Run workflow** (it also runs on every push).
3. When it finishes, download **CropAdvisor-debug-apk** from the run's *Artifacts*, unzip, and copy `app-debug.apk` to your phone.
4. On the phone allow "Install unknown apps" for your file manager/browser, then tap the APK.

## Get the APK – Option B: locally
Needs Node 20+, JDK 21 and Android Studio (for the Android SDK).
```bash
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug      # Windows: gradlew.bat assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
After editing anything in `www/`, run `npx cap sync android` and rebuild.

## Install as an app without an APK (PWA)
Host `www/` on any HTTPS static host (GitHub Pages, Netlify, Vercel). Open the URL in Chrome
on the phone → menu → **Install app / Add to Home screen**. Works offline after first load.

## Retraining
Retrain in your notebook, save `crop_model.pkl`, then: `python tools/export_model.py crop_model.pkl`
(needs `joblib`, `scikit-learn`, `numpy`).
