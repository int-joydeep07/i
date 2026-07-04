/* ============================================================
   notifications.js
   Handles the notification ON/OFF switch, browser Notification
   API permission, an audible ping, and service worker
   registration so notifications can appear even when the tab
   isn't focused.
   ============================================================ */

const Notifications = (() => {

  let audioCtx = null;

  function isEnabled() {
    const stored = Utils.getLS("notifications", true);
    return stored !== false;
  }

  function setEnabled(value) {
    Utils.setLS("notifications", value);
  }

  async function toggle() {
    const next = !isEnabled();
    if (next) {
      const granted = await requestPermission();
      if (!granted) {
        UI.toast("Notifications blocked in browser settings.", "error");
        setEnabled(false);
        return isEnabled();
      }
    }
    setEnabled(next);
    return next;
  }

  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  function playPing() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // Audio not available (autoplay restrictions, etc.) - fail silently
    }
  }

  function showMessageNotification({ title, body, onClick }) {
    if (!isEnabled()) return;
    playPing();

    if (document.visibilityState === "visible") {
      // Tab is focused - a toast is less intrusive than a system notification
      UI.toast(`${title}: ${body}`, "info");
      return;
    }

    if (!("Notification" in window) || Notification.permission !== "granted") return;

    try {
      const n = new Notification(title, {
        body,
        icon: "https://api.iconify.design/mdi/message-text.svg?color=%2325d366",
        tag: "inta-message"
      });
      n.onclick = () => {
        window.focus();
        if (onClick) onClick();
        n.close();
      };
    } catch (e) {
      console.warn("Notification failed", e);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }

  return { isEnabled, setEnabled, toggle, requestPermission, showMessageNotification, registerServiceWorker };
})();
