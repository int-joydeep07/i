/* ============================================================
   profile.js
   Profile panel: shows the current user's avatar / username /
   ID, and lets them change their name, password, or photo.

   Photos are resized client-side and stored as a compact data
   URL directly on the user record, so no extra storage bucket
   is required. Swap this for Firebase Storage if you expect
   many/large photos.
   ============================================================ */

const Profile = (() => {

  let myId = null;
  const els = {};

  function cacheEls() {
    els.panel = document.getElementById("profilePanel");
    els.avatar = document.getElementById("profileAvatar");
    els.username = document.getElementById("profileUsername");
    els.idText = document.getElementById("profileIdText");
    els.closeBtn = document.getElementById("closeProfileBtn");
    els.photoInput = document.getElementById("profilePhotoInput");
    els.changeNameBtn = document.getElementById("profileChangeNameBtn");
    els.changePasswordBtn = document.getElementById("profileChangePasswordBtn");
  }

  function init(userId) {
    myId = userId;
    cacheEls();

    els.closeBtn.addEventListener("click", () => UI.closePanel(els.panel));
    els.photoInput.addEventListener("change", handlePhotoChange);
    els.changeNameBtn.addEventListener("click", changeName);
    els.changePasswordBtn.addEventListener("click", changePassword);

    DB.user(myId).on("value", (snap) => {
      const u = snap.val();
      if (!u) return;
      render(u);
    });
  }

  function render(user) {
    els.username.textContent = user.username;
    els.idText.textContent = `ID: ${user.id}`;
    els.avatar.style.background = Utils.colorFromId(user.id);
    els.avatar.style.backgroundImage = user.photoURL ? `url(${user.photoURL})` : "";
    els.avatar.textContent = user.photoURL ? "" : Utils.initials(user.username);

    document.getElementById("myIdText").textContent = user.id;
    localStorage.setItem("username", user.username);
  }

  function open() {
    UI.openPanel(els.panel);
  }

  async function changeName() {
    const current = els.username.textContent;
    const newName = await UI.promptDialog("Enter a new username", { placeholder: "Username", initialValue: current });
    if (newName === null) return;
    if (newName.length < 3 || newName.length > 24) {
      UI.toast("Username must be 3–24 characters.", "error");
      return;
    }
    try {
      await DB.user(myId).update({ username: newName, usernameLower: newName.toLowerCase() });
      UI.toast("Name updated", "success");
    } catch (e) {
      UI.toast("Could not update name.", "error");
    }
  }

  async function changePassword() {
    const newPass = await UI.promptDialog("Enter a new password", { placeholder: "New password" });
    if (newPass === null) return;
    if (newPass.length < 4) {
      UI.toast("Password must be at least 4 characters.", "error");
      return;
    }
    try {
      const enc = new TextEncoder().encode(newPass);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      await DB.user(myId).update({ passwordHash: hash });
      UI.toast("Password updated", "success");
    } catch (e) {
      UI.toast("Could not update password.", "error");
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      UI.toast("Please choose an image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const dataUrl = resizeToDataUrl(img, 160);
        try {
          await DB.user(myId).update({ photoURL: dataUrl });
          UI.toast("Profile photo updated", "success");
        } catch (err) {
          UI.toast("Could not save photo.", "error");
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resizeToDataUrl(img, maxSize) {
    const canvas = document.createElement("canvas");
    let { width, height } = img;
    if (width > height) {
      if (width > maxSize) { height *= maxSize / width; width = maxSize; }
    } else {
      if (height > maxSize) { width *= maxSize / height; height = maxSize; }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  return { init, open };
})();
