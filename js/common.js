// Κοινές ρυθμίσεις τηλεόρασης + χειριστηρίου
window.TVP = {
  // Δημόσια διεύθυνση του παιχνιδιού (GitHub Pages). Μέσα στην εφαρμογή Android TV
  // ο QR δείχνει εδώ, γιατί τα κινητά δεν βλέπουν τα εσωτερικά αρχεία της εφαρμογής.
  WEB_URL: 'https://gash7410.github.io/lydi-tv-games/',
  isApp: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
  PREFIX: 'tvparty49-cups-',
  COLORS: [
    { name: 'Κόκκινος', hex: '#f0544f' },
    { name: 'Μπλε',     hex: '#3da9ff' },
    { name: 'Μωβ',      hex: '#9b5de5' },
    { name: 'Κίτρινος', hex: '#ffc93d' },
  ],
  peerOptions: {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    },
  },
};
