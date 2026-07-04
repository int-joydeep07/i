/* ============================================================
   firebase.js
   Firebase initialization + shared database/auth references.
   ------------------------------------------------------------
   Replace the firebaseConfig values below with your own project
   credentials from the Firebase console:
   https://console.firebase.google.com/  →  Project settings → SDK setup
   ============================================================ */

// TODO: replace with your real Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAIa_Ao9VGm71va2srCf5iNabAtm4Nop3o",
  authDomain: "inta-in.firebaseapp.com",
  databaseURL: "https://inta-in-default-rtdb.firebaseio.com",
  projectId: "inta-in",
  storageBucket: "inta-in.firebasestorage.app",
  messagingSenderId: "907356328100",
  appId: "1:907356328100:web:68d441e9472bcd6fc65631",
  measurementId: "G-KV6992ZN99"
};

// Initialize Firebase (compat SDK is loaded via <script> tags in the HTML files)
firebase.initializeApp(firebaseConfig);

// Shared references used across every module
const db = firebase.database();
const auth = firebase.auth();

/* ------------------------------------------------------------
   Database path helpers
   Keeping every path in one place avoids typos and makes the
   schema easy to change later.
   ------------------------------------------------------------ */
const DB = {
  users: () => db.ref("users"),
  user: (id) => db.ref(`users/${id}`),

  friends: (id) => db.ref(`friends/${id}`),
  friendEntry: (id, friendId) => db.ref(`friends/${id}/${friendId}`),

  chatId: (a, b) => [a, b].sort().join("_"),
  messages: (chatId) => db.ref(`messages/${chatId}`),
  message: (chatId, messageId) => db.ref(`messages/${chatId}/${messageId}`),

  chatMeta: (id) => db.ref(`chatMeta/${id}`), // per-user chat list cache (last msg, unread count)
  chatMetaEntry: (id, otherId) => db.ref(`chatMeta/${id}/${otherId}`),

  typing: (chatId) => db.ref(`system/typing/${chatId}`),
  presence: (id) => db.ref(`users/${id}`),

  idCounter: () => db.ref("system/idCounter"),
  usedIds: () => db.ref("system/usedIds")
};
