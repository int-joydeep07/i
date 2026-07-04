/* ============================================================
   auth.js
   Handles account creation and login.

   Accounts are keyed by a permanent 9-digit numeric ID that is
   generated once and never reused, even after deletion. We use
   a Firebase transaction against system/usedIds/{id} to reserve
   an ID atomically, so two signups can never collide.

   Passwords: this demo hashes passwords client-side with SHA-256
   before storing them. For a production app, swap this for
   Firebase Authentication's built-in email/password (or custom
   token) flow so passwords never touch your own database.
   ============================================================ */

(function () {

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /** Atomically reserve a fresh, never-before-used 9-digit ID */
  async function reserveNewId() {
    const usedIdsRef = DB.usedIds();
    let attempts = 0;

    while (attempts < 25) {
      attempts++;
      const candidate = Utils.randomNineDigitId();
      const candidateRef = usedIdsRef.child(candidate);

      const result = await candidateRef.transaction((current) => {
        if (current === null) {
          return true; // claim it
        }
        return; // abort - already used, undefined aborts the transaction
      });

      if (result.committed) {
        return candidate;
      }
      // collision (extremely rare with 9 digits) - loop and try another
    }
    throw new Error("Could not generate a unique ID. Please try again.");
  }

  async function usernameTaken(username) {
    const snap = await DB.users()
      .orderByChild("usernameLower")
      .equalTo(username.toLowerCase())
      .once("value");
    return snap.exists();
  }

  async function signup({ username, password }) {
    username = username.trim();
    if (username.length < 3) throw new Error("Username must be at least 3 characters.");
    if (username.length > 24) throw new Error("Username must be under 24 characters.");
    if (!/^[a-zA-Z0-9_ ]+$/.test(username)) throw new Error("Username can only contain letters, numbers, spaces and underscores.");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters.");

    if (await usernameTaken(username)) {
      throw new Error("That username is already taken.");
    }

    const id = await reserveNewId();
    const passwordHash = await sha256(password);

    const userRecord = {
      id,
      username,
      usernameLower: username.toLowerCase(),
      passwordHash,
      photoURL: "",
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      online: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      notificationsEnabled: true
    };

    await DB.user(id).set(userRecord);

    return { id, username };
  }

  async function login({ id, password }) {
    id = id.trim();
    if (!/^\d{9}$/.test(id)) throw new Error("Enter your 9-digit ID.");
    if (!password) throw new Error("Enter your password.");

    const snap = await DB.user(id).once("value");
    if (!snap.exists()) throw new Error("No account found with that ID.");

    const user = snap.val();
    const passwordHash = await sha256(password);
    if (passwordHash !== user.passwordHash) {
      throw new Error("Incorrect password.");
    }

    await DB.user(id).update({
      online: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    return { id, username: user.username };
  }

  function persistSession({ id, username }) {
    localStorage.setItem("userId", id);
    localStorage.setItem("username", username);
  }

  function clearSession() {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
  }

  async function logout() {
    const id = localStorage.getItem("userId");
    if (id) {
      try {
        await DB.user(id).update({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (e) {
        console.warn("Failed to update offline status on logout", e);
      }
    }
    clearSession();
    window.location.href = "index.html";
  }

  window.Auth = { signup, login, persistSession, clearSession, logout };
})();
