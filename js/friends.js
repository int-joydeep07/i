/* ============================================================
   friends.js
   - Look up a user by ID (Add Friend panel)
   - Add / remove friends (mutual relationship)
   - Search within the friend list (Search panel)
   ============================================================ */

const Friends = (() => {

  async function findUserById(id) {
    const snap = await DB.user(id).once("value");
    if (!snap.exists()) return null;
    return snap.val();
  }

  async function areFriends(myId, otherId) {
    const snap = await DB.friendEntry(myId, otherId).once("value");
    return snap.exists();
  }

  /** Adds a mutual friendship between the two IDs in a single atomic update */
  async function addFriend(myId, friendId) {
    if (myId === friendId) throw new Error("You can't add yourself as a friend.");

    const target = await findUserById(friendId);
    if (!target) throw new Error("No user exists with that ID.");

    if (await areFriends(myId, friendId)) {
      throw new Error("You're already friends with this user.");
    }

    const updates = {};
    updates[`friends/${myId}/${friendId}`] = { addedAt: firebase.database.ServerValue.TIMESTAMP };
    updates[`friends/${friendId}/${myId}`] = { addedAt: firebase.database.ServerValue.TIMESTAMP };

    await db.ref().update(updates);
    return target;
  }

  async function removeFriend(myId, friendId) {
    const updates = {};
    updates[`friends/${myId}/${friendId}`] = null;
    updates[`friends/${friendId}/${myId}`] = null;
    await db.ref().update(updates);
  }

  /** Subscribes to the current user's friend list; calls onChange(friendIdsArray) whenever it changes */
  function listenFriendIds(myId, onChange) {
    const ref = DB.friends(myId);
    const handler = (snap) => {
      const val = snap.val() || {};
      onChange(Object.keys(val));
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
  }

  /** One-off search across the user's existing friends by name or ID substring */
  async function searchMyFriends(myId, query) {
    const snap = await DB.friends(myId).once("value");
    const friendIds = Object.keys(snap.val() || {});
    if (friendIds.length === 0) return [];

    const q = query.trim().toLowerCase();
    const users = await Promise.all(friendIds.map((id) => findUserById(id)));

    return users
      .filter(Boolean)
      .filter((u) => u.id.includes(q) || u.username.toLowerCase().includes(q));
  }

  return { findUserById, areFriends, addFriend, removeFriend, listenFriendIds, searchMyFriends };
})();
