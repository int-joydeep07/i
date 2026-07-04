/* ============================================================
   chat.js
   Drives the single conversation screen: sending & receiving
   messages in realtime, left/right bubble placement, message
   status ticks (sent / delivered / seen), typing indicator,
   and presence (online / last seen).
   ============================================================ */

const Chat = (() => {
  // Open
chatScreen.classList.add("chat-screen--open");
chatListScreen.classList.add("chat-list-screen--behind");

// Close
chatScreen.classList.remove("chat-screen--open");
chatListScreen.classList.remove("chat-list-screen--behind");

  let myId = null;
  let currentFriendId = null;
  let currentChatId = null;

  let messagesRef = null;
  let messagesHandler = null;
  let typingRef = null;
  let typingHandler = null;
  let presenceRef = null;
  let presenceHandler = null;

  let typingTimeout = null;
  let lastRenderedDay = null;
  let renderedMessageIds = new Set();

  const els = {};
  let onCloseCallback = null;

  function cacheEls() {
    els.screen = document.getElementById("chatScreen");
    els.messages = document.getElementById("chatMessages");
    els.avatar = document.getElementById("chatAvatar");
    els.name = document.getElementById("chatHeaderName");
    els.status = document.getElementById("chatHeaderStatus");
    els.composer = document.getElementById("chatComposer");
    els.input = document.getElementById("chatInput");
    els.sendBtn = document.getElementById("sendBtn");
    els.typingIndicator = document.getElementById("typingIndicator");
    els.backBtn = document.getElementById("chatBackBtn");
    els.menuBtn = document.getElementById("chatMenuBtn");
    els.menuDropdown = document.getElementById("chatMenuDropdown");
    els.unfriendBtn = document.getElementById("chatUnfriendBtn");
  }

  function init(userId, { onClose } = {}) {
    myId = userId;
    onCloseCallback = onClose || null;
    cacheEls();

    els.backBtn.addEventListener("click", closeChat);

    els.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSend();
    });

    els.input.addEventListener("input", () => {
      handleTyping();
      els.sendBtn.disabled = !els.input.value.trim();
    });

    els.menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.menuDropdown.classList.toggle("dropdown--open");
    });
    document.addEventListener("click", () => els.menuDropdown.classList.remove("dropdown--open"));

    els.unfriendBtn.addEventListener("click", async () => {
      els.menuDropdown.classList.remove("dropdown--open");
      if (!currentFriendId) return;
      const ok = await UI.confirmDialog("Remove this friend? Your chat history will remain but you won't be able to send new messages until you add them again.", { confirmText: "Remove", danger: true });
      if (!ok) return;
      await Friends.removeFriend(myId, currentFriendId);
      UI.toast("Friend removed", "success");
      closeChat();
    });
  }

  async function openChat(friendId) {
    if (currentFriendId === friendId && els.screen.classList.contains("chat-screen--open")) return;

    detachListeners();
    currentFriendId = friendId;
    currentChatId = DB.chatId(myId, friendId);
    lastRenderedDay = null;
    renderedMessageIds = new Set();
    els.messages.innerHTML = "";
    els.input.value = "";
    els.sendBtn.disabled = true;

    const friend = await Friends.findUserById(friendId);
    if (!friend) {
      UI.toast("This user no longer exists.", "error");
      return;
    }

    renderHeader(friend);
    els.screen.classList.add("chat-screen--open");

    listenPresence(friendId);
    listenMessages();
    listenTyping();
    clearUnread(friendId);

    setTimeout(() => els.input.focus(), 260);
  }

  function closeChat() {
    els.screen.classList.remove("chat-screen--open");
    detachListeners();
    setTypingState(false);
    currentFriendId = null;
    currentChatId = null;
    if (onCloseCallback) onCloseCallback();
  }

  function detachListeners() {
    if (messagesRef && messagesHandler) messagesRef.off("child_added", messagesHandler.added);
    if (messagesRef && messagesHandler) messagesRef.off("child_changed", messagesHandler.changed);
    if (typingRef && typingHandler) typingRef.off("value", typingHandler);
    if (presenceRef && presenceHandler) presenceRef.off("value", presenceHandler);
    messagesRef = null; typingRef = null; presenceRef = null;
  }

  function renderHeader(friend) {
    els.name.textContent = friend.username;
    els.avatar.style.background = Utils.colorFromId(friend.id);
    els.avatar.style.backgroundImage = friend.photoURL ? `url(${friend.photoURL})` : "";
    els.avatar.textContent = friend.photoURL ? "" : Utils.initials(friend.username);
  }

  function listenPresence(friendId) {
    presenceRef = DB.user(friendId);
    presenceHandler = (snap) => {
      const u = snap.val();
      if (!u) return;
      els.status.textContent = u.online ? "Online" : Utils.formatLastSeen(u.lastSeen);
    };
    presenceRef.on("value", presenceHandler);
  }

  function listenMessages() {
    messagesRef = DB.messages(currentChatId);
    messagesHandler = {
      added: (snap) => {
        const msg = snap.val();
        renderMessage(snap.key, msg);
        scrollToBottom();
        if (msg.senderId !== myId) {
          markDelivered(snap.key, msg);
          if (isScreenOpen()) markSeen(snap.key, msg);
        }
      },
      changed: (snap) => {
        updateBubbleStatus(snap.key, snap.val());
      }
    };
    messagesRef.on("child_added", messagesHandler.added);
    messagesRef.on("child_changed", messagesHandler.changed);
  }

  function listenTyping() {
    typingRef = DB.typing(currentChatId).child(currentFriendId);
    typingHandler = (snap) => {
      const isTyping = !!snap.val();
      els.typingIndicator.classList.toggle("typing-indicator--show", isTyping);
      if (isTyping) els.status.textContent = "typing…";
      else if (presenceRef) presenceRef.once("value").then(s => {
        const u = s.val();
        if (u) els.status.textContent = u.online ? "Online" : Utils.formatLastSeen(u.lastSeen);
      });
    };
    typingRef.on("value", typingHandler);
  }

  function handleTyping() {
    setTypingState(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => setTypingState(false), 2000);
  }

  function setTypingState(isTyping) {
    if (!currentChatId) return;
    DB.typing(currentChatId).child(myId).set(isTyping || null);
  }

  async function handleSend() {
    const text = els.input.value.trim();
    if (!text || !currentFriendId) return;
    if (currentFriendId === myId) return; // safety: never self-message

    els.input.value = "";
    els.sendBtn.disabled = true;
    setTypingState(false);
    clearTimeout(typingTimeout);

    const stillFriends = await Friends.areFriends(myId, currentFriendId);
    if (!stillFriends) {
      UI.toast("You're no longer friends with this user.", "error");
      return;
    }

    const msgRef = DB.messages(currentChatId).push();
    const message = {
      senderId: myId,
      receiverId: currentFriendId,
      text,
      time: firebase.database.ServerValue.TIMESTAMP,
      delivered: false,
      seen: false
    };

    try {
      await msgRef.set(message);
      await updateChatMeta(text);
    } catch (err) {
      UI.toast("Message failed to send.", "error");
      console.error(err);
    }
  }

  async function updateChatMeta(lastText) {
    const now = firebase.database.ServerValue.TIMESTAMP;
    const updates = {};
    updates[`chatMeta/${myId}/${currentFriendId}/lastMessage`] = lastText;
    updates[`chatMeta/${myId}/${currentFriendId}/lastMessageTime`] = now;
    updates[`chatMeta/${myId}/${currentFriendId}/lastSenderId`] = myId;
    updates[`chatMeta/${myId}/${currentFriendId}/unreadCount`] = 0;
    updates[`chatMeta/${myId}/${currentFriendId}/lastMessageSeen`] = false;

    updates[`chatMeta/${currentFriendId}/${myId}/lastMessage`] = lastText;
    updates[`chatMeta/${currentFriendId}/${myId}/lastMessageTime`] = now;
    updates[`chatMeta/${currentFriendId}/${myId}/lastSenderId`] = myId;

    await db.ref().update(updates);

    // Bump receiver's unread count via transaction so concurrent sends don't clobber it
    await db.ref(`chatMeta/${currentFriendId}/${myId}/unreadCount`).transaction((cur) => (cur || 0) + 1);
  }

  function markDelivered(key, msg) {
    if (msg.delivered) return;
    DB.message(currentChatId, key).update({ delivered: true });
  }

  function markSeen(key, msg) {
    if (msg.seen) return;
    DB.message(currentChatId, key).update({ seen: true, delivered: true });
    // Mirror onto the sender's chat-list preview so their list shows blue ticks too
    db.ref(`chatMeta/${msg.senderId}/${myId}/lastMessageSeen`).set(true);
  }

  function clearUnread(friendId) {
    db.ref(`chatMeta/${myId}/${friendId}/unreadCount`).set(0);
  }

  function isScreenOpen() {
    return els.screen.classList.contains("chat-screen--open");
  }

  function renderMessage(id, msg) {
    if (renderedMessageIds.has(id)) return;
    renderedMessageIds.add(id);

    maybeInsertDayDivider(msg.time);

    const isMine = msg.senderId === myId;
    const row = document.createElement("div");
    row.className = `bubble-row ${isMine ? "bubble-row--mine" : "bubble-row--theirs"}`;
    row.dataset.msgId = id;

    const bubble = document.createElement("div");
    bubble.className = `bubble ${isMine ? "bubble--mine" : "bubble--theirs"}`;

    const textEl = document.createElement("span");
    textEl.className = "bubble-text";
    textEl.textContent = msg.text;
    bubble.appendChild(textEl);

    const meta = document.createElement("div");
    meta.className = "bubble-meta";
    meta.innerHTML = `<span class="msg-time">${Utils.formatTime(msg.time)}</span>` + (isMine ? ` <span class="ticks">${tickIcon(msg)}</span>` : "");
    bubble.appendChild(meta);

    row.appendChild(bubble);
    els.messages.appendChild(row);
  }

  function updateBubbleStatus(id, msg) {
    const row = els.messages.querySelector(`[data-msg-id="${id}"]`);
    if (!row) return;
    const ticksEl = row.querySelector(".ticks");
    if (ticksEl) ticksEl.innerHTML = tickIcon(msg);
  }

  function tickIcon(msg) {
    if (msg.seen) return `<span class="ticks--seen">✓✓</span>`;
    if (msg.delivered) return `✓✓`;
    return `✓`;
  }

  function maybeInsertDayDivider(ts) {
    if (!ts) return;
    const dayKey = new Date(ts).toDateString();
    if (dayKey === lastRenderedDay) return;
    lastRenderedDay = dayKey;

    const divider = document.createElement("div");
    divider.className = "msg-day-divider";
    const now = new Date();
    const d = new Date(ts);
    divider.textContent = d.toDateString() === now.toDateString() ? "Today" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    els.messages.appendChild(divider);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    });
  }

  return { init, openChat, closeChat };
})();
