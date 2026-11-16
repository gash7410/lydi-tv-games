# Lydi TV Games

Party παιχνίδια για την τηλεόραση: η TV δείχνει το παιχνίδι και τα κινητά γίνονται χειριστήρια (σκανάρεις τον QR). Πρώτο παιχνίδι: **Μπαλάκι στα ποτηράκια**, για 1–4 παίκτες.

## Εγκατάσταση στην Android TV
1. Από το Play Store της TV εγκατέστησε το **Downloader** (AFTVnews) και επίτρεψέ του τις «άγνωστες πηγές».
2. Στο Downloader γράψε:
   `https://github.com/gash7410/lydi-tv-games/releases/latest/download/LydiTVGames.apk`
3. Εγκατάσταση → η εφαρμογή εμφανίζεται στην αρχική οθόνη της TV.

Για αυτόματες ενημερώσεις: **Obtainium** → Add app → `https://github.com/gash7410/lydi-tv-games`.

## Παίξε από browser
- Τηλεόραση / υπολογιστής: https://gash7410.github.io/lydi-tv-games/
- Χειριστήριο κινητού: https://gash7410.github.io/lydi-tv-games/controller.html

## Πώς χτίζεται
Κάθε push στο `main`: το GitHub Actions φτιάχνει το APK (Capacitor) και το ανεβάζει στη release «latest». Το site σερβίρεται από το GitHub Pages (ρίζα του repo).
Τοπικά: `npm install && npm run sync` (αντιγράφει τα αρχεία στο `www/` και συγχρονίζει το `android/`).
