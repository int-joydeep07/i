/* ============================================================
   home.js
   Boots the app once home.html loads: wires up the top bar,
   renders the realtime chat list, and connects the Add Friend /
   Search / Profile panels and the single chat screen.
   ============================================================ */

(function () {

  const myId = Utils.requireLoginOrRedirect();
  if (!myId) return; // redirected to index.html

  const myUsername = localStorage.getItem("username") || "You";

  // friendId -> { user, meta, unsubUser, unsubMeta, lastNotifiedTime }
  const friendState = new Map();
  let unsubFriendIds = null;
  let currentOpenFriendId = null;

  const el = (id) => document.getElementById(id);

  /* ---------------- Presence ---------------- */
  function setupPresence() {
    const myRef = DB.user(myId);
    const connectedRef = db.ref(".info/connected");

    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        myRef.onDisconnect().update({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        myRef.update({ online: true });
      }
    });

    window.addEventListener("beforeunload", () => {
      myRef.update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    });
  }

  /* ---------------- Top bar: my ID + menu ---------------- */
  function setupTopBar() {
    el("myIdText").textContent = myId;
    el("copyIdBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(myId);
        UI.toast("ID copied to clipboard", "success");
      } catch (e) {
        UI.toast(myId, "info");
      }
    });

    const menuBtn = el("menuBtn");
    const menuDropdown = el("menuDropdown");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle("dropdown--open");
    });
    document.addEventListener("click", () => menuDropdown.classList.remove("dropdown--open"));

    el("menuChangeName").addEventListener("click", () => {
      menuDropdown.classList.remove("dropdown--open");
      Profile.open();
    });
    el("menuProfile").addEventListener("click", () => {
      menuDropdown.classList.remove("dropdown--open");
      Profile.open();
    });
    el("menuTheme").addEventListener("click", () => {
      menuDropdown.classList.remove("dropdown--open");
      toggleTheme();
    });
    el("menuLogout").addEventListener("click", async () => {
      menuDropdown.classList.remove("dropdown--open");
      const ok = await UI.confirmDialog("Log out of Inta?", { confirmText: "Logout", danger: true });
      if (ok) Auth.logout();
    });
  }

  function toggleTheme() {
    const body = document.body;
    const next = body.dataset.theme === "dark" ? "light" : "dark";
    body.dataset.theme = next;
    Utils.setLS("theme", next);
  }

  function applySavedTheme() {
    const saved = Utils.getLS("theme", "light");
    document.body.dataset.theme = saved;
  }

  /* ---------------- Notifications toggle ---------------- */
  function setupNotifButton() {
    const dot = el("notifDot");
    const render = () => dot.classList.toggle("notif-dot--off", !Notifications.isEnabled());
    render();
    el("notifBtn").addEventListener("click", async () => {
      const enabled = await Notifications.toggle();
      render();
      UI.toast(enabled ? "Notifications on" : "Notifications off", "info");
    });
    Notifications.registerServiceWorker();
  }

  /* ---------------- Add Friend panel ---------------- */
  function setupAddFriendPanel() {
    const panel = el("addFriendPanel");
    const idInput = el("addFriendIdInput");
    const lookupBtn = el("addFriendLookupBtn");
    const card = el("foundUserCard");
    const errorEl = el("addFriendError");
    const addBtn = el("foundUserAddBtn");
    let foundUser = null;

    el("addFriendFab").addEventListener("click", () => {
      idInput.value = "";
      card.classList.add("found-user--hidden");
      errorEl.textContent = "";
      foundUser = null;
      UI.openPanel(panel);
      setTimeout(() => idInput.focus(), 260);
    });
    el("closeAddFriendBtn").addEventListener("click", () => UI.closePanel(panel));

    idInput.addEventListener("input", () => {
      idInput.value = idInput.value.replace(/\D/g, "").slice(0, 9);
    });

    lookupBtn.addEventListener("click", async () => {
      errorEl.textContent = "";
      card.classList.add("found-user--hidden");
      const id = idInput.value.trim();

      if (!/^\d{9}$/.test(id)) {
        errorEl.textContent = "Enter a valid 9-digit ID.";
        return;
      }
      if (id === myId) {
        errorEl.textContent = "That's your own ID.";
        return;
      }

      UI.setLoading(lookupBtn, true, "Searching…");
      try {
        const user = await Friends.findUserById(id);
        if (!user) {
          errorEl.textContent = "No user found with that ID.";
        } else {
          foundUser = user;
          el("foundUserAvatar").style.background = Utils.colorFromId(user.id);
          el("foundUserAvatar").style.backgroundImage = user.photoURL ? `url(${user.photoURL})` : "";
          el("foundUserAvatar").textContent = user.photoURL ? "" : Utils.initials(user.username);
          el("foundUserName").textContent = user.username;
          el("foundUserId").textContent = `ID: ${user.id}`;
          card.classList.remove("found-user--hidden");
        }
      } catch (e) {
        errorEl.textContent = "Something went wrong. Try again.";
      } finally {
        UI.setLoading(lookupBtn, false);
      }
    });

    addBtn.addEventListener("click", async () => {
      if (!foundUser) return;
      UI.setLoading(addBtn, true, "Adding…");
      try {
        await Friends.addFriend(myId, foundUser.id);
        UI.toast(`${foundUser.username} added`, "success");
        UI.closePanel(panel);
      } catch (e) {
        errorEl.textContent = e.message;
      } finally {
        UI.setLoading(addBtn, false);
      }
    });
  }

  /* ---------------- Search panel ---------------- */
  function setupSearchPanel() {
    const panel = el("searchPanel");
    const input = el("searchInput");
    const results = el("searchResults");

    el("searchBtn").addEventListener("click", () => {
      input.value = "";
      results.innerHTML = "";
      UI.openPanel(panel);
      setTimeout(() => input.focus(), 260);
    });
    el("closeSearchBtn").addEventListener("click", () => UI.closePanel(panel));

    const runSearch = Utils.debounce(async () => {
      const q = input.value.trim();
      if (!q) { results.innerHTML = ""; return; }
      const matches = await Friends.searchMyFriends(myId, q);
      renderSearchResults(matches);
    }, 250);

    input.addEventListener("input", runSearch);

    function renderSearchResults(matches) {
      if (matches.length === 0) {
        results.innerHTML = `<div class="search-empty">No friends match your search.</div>`;
        return;
      }
      results.innerHTML = "";
      matches.forEach((user) => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.innerHTML = `
          <div class="avatar" style="width:42px;height:42px;font-size:14px;background:${Utils.colorFromId(user.id)};${user.photoURL ? `background-image:url(${user.photoURL})` : ""}">${user.photoURL ? "" : Utils.initials(user.username)}</div>
          <div>
            <div style="font-weight:600;font-size:14.5px;">${Utils.escapeHtml(user.username)}</div>
            <div style="font-size:12px;color:var(--text-faint)">ID: ${user.id}</div>
          </div>`;
        item.addEventListener("click", () => {
          UI.closePanel(panel);
          openChatWith(user.id);
        });
        results.appendChild(item);
      });
    }
  }

  /* ---------------- Chat list ---------------- */
  function setupChatList() {
    unsubFriendIds = Friends.listenFriendIds(myId, (friendIds) => {
      const idSet = new Set(friendIds);

      // Remove friends no longer present
      for (const [fid, state] of friendState.entries()) {
        if (!idSet.has(fid)) {
          state.unsubUser();
          state.unsubMeta();
          friendState.delete(fid);
        }
      }

      // Add new friends
      friendIds.forEach((fid) => {
        if (friendState.has(fid)) return;
        subscribeToFriend(fid);
      });

      renderEmptyState(friendIds.length === 0);
    });
  }

  function subscribeToFriend(friendId) {
    const state = { user: null, meta: null };
    const userRef = DB.user(friendId);
    const metaRef = DB.chatMetaEntry(myId, friendId);

    const userHandler = (snap) => {
      state.user = snap.val();
      renderChatList();
    };
    const metaHandler = (snap) => {
      const meta = snap.val();
      const prevTime = state.meta ? state.meta.lastMessageTime : null;
      state.meta = meta;

      // Fire a notification for genuinely new incoming messages
      if (meta && meta.lastMessageTime && meta.lastMessageTime !== prevTime &&
          meta.lastSenderId && meta.lastSenderId !== myId &&
          currentOpenFriendId !== friendId) {
        const name = state.user ? state.user.username : "New message";
        Notifications.showMessageNotification({
          title: name,
          body: meta.lastMessage || "New message",
          onClick: () => openChatWith(friendId)
        });
      }

      renderChatList();
    };

    userRef.on("value", userHandler);
    metaRef.on("value", metaHandler);

    state.unsubUser = () => userRef.off("value", userHandler);
    state.unsubMeta = () => metaRef.off("value", metaHandler);
    friendState.set(friendId, state);
  }

  function renderEmptyState(isEmpty) {
    el("chatListEmpty").classList.toggle("empty-state--hidden", !isEmpty);
  }

  const renderChatList = Utils.debounce(() => {
    const container = el("chatList");
    const entries = Array.from(friendState.entries())
      .filter(([, s]) => s.user);

    entries.sort(([, a], [, b]) => {
      const ta = (a.meta && a.meta.lastMessageTime) || 0;
      const tb = (b.meta && b.meta.lastMessageTime) || 0;
      if (ta !== tb) return tb - ta;
      return (a.user.username || "").localeCompare(b.user.username || "");
    });

    container.innerHTML = "";
    entries.forEach(([friendId, state]) => {
      container.appendChild(buildChatItem(friendId, state));
    });

    cacheChatListSnapshot(entries);
  }, 30);

  /** Cache a lightweight snapshot so the list can paint instantly on next load,
   *  before Firebase listeners have reconnected (helps on slow connections). */
  function cacheChatListSnapshot(entries) {
    const snapshot = entries.map(([friendId, state]) => ({
      friendId,
      username: state.user.username,
      photoURL: state.user.photoURL || "",
      online: !!state.user.online,
      lastMessage: state.meta ? state.meta.lastMessage : "",
      lastMessageTime: state.meta ? state.meta.lastMessageTime : 0,
      lastSenderId: state.meta ? state.meta.lastSenderId : "",
      lastMessageSeen: state.meta ? !!state.meta.lastMessageSeen : false,
      unreadCount: state.meta ? state.meta.unreadCount || 0 : 0
    }));
    Utils.setLS("chatListCache", snapshot);
  }

  function paintFromCache() {
    const cached = Utils.getLS("chatListCache", []);
    if (!cached || cached.length === 0) return;
    const container = el("chatList");
    container.innerHTML = "";
    cached.forEach((c) => {
      container.appendChild(buildChatItem(c.friendId, {
        user: { id: c.friendId, username: c.username, photoURL: c.photoURL, online: c.online },
        meta: { lastMessage: c.lastMessage, lastMessageTime: c.lastMessageTime, lastSenderId: c.lastSenderId, lastMessageSeen: c.lastMessageSeen, unreadCount: c.unreadCount }
      }));
    });
    renderEmptyState(false);
  }

  function buildChatItem(friendId, state) {
    const { user, meta } = state;
    const item = document.createElement("div");
    item.className = "chat-item";
    item.dataset.friendId = friendId;

    const unread = (meta && meta.unreadCount) || 0;
    const lastMessage = meta && meta.lastMessage ? Utils.escapeHtml(meta.lastMessage) : "Say hello 👋";
    const lastTime = meta && meta.lastMessageTime ? Utils.formatListTime(meta.lastMessageTime) : "";
    const isMineLast = meta && meta.lastSenderId === myId;

    item.innerHTML = `
      <div class="avatar" style="background:${Utils.colorFromId(user.id)};${user.photoURL ? `background-image:url(${user.photoURL})` : ""}">
        ${user.photoURL ? "" : Utils.initials(user.username)}
        <span class="avatar-online-dot ${user.online ? "avatar-online-dot--show" : ""}"></span>
      </div>
      <div class="chat-item-main">
        <div class="chat-item-top">
          <span class="chat-item-name">${Utils.escapeHtml(user.username)}<span class="chat-item-id">${user.id}</span></span>
          <span class="chat-item-time ${unread > 0 ? "chat-item-time--unread" : ""}">${lastTime}</span>
        </div>
        <div class="chat-item-bottom">
          <span class="chat-item-preview">${isMineLast ? `<span class="ticks ${meta && meta.lastMessageSeen ? "ticks--seen" : ""}">✓✓</span>` : ""} ${lastMessage}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? "99+" : unread}</span>` : ""}
        </div>
      </div>`;

    item.addEventListener("click", () => openChatWith(friendId));
    return item;
  }

  function openChatWith(friendId) {
    currentOpenFriendId = friendId;
    Chat.openChat(friendId);
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    applySavedTheme();
    setupPresence();
    setupTopBar();
    setupNotifButton();
    setupAddFriendPanel();
    setupSearchPanel();
    paintFromCache();
    setupChatList();

    Chat.init(myId, { onClose: () => { currentOpenFriendId = null; } });
    Profile.init(myId);
  }

  boot();
})();
