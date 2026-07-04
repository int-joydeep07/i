/* ============================================================
   utils.js
   Small, dependency-free helper functions shared by every page.
   ============================================================ */

const Utils = (() => {

  /** Generate a random 9-digit numeric string, e.g. "873633365" */
  function randomNineDigitId() {
    // First digit 1-9 so it never starts with 0
    let id = String(Math.floor(1 + Math.random() * 9));
    for (let i = 0; i < 8; i++) {
      id += String(Math.floor(Math.random() * 10));
    }
    return id;
  }

  /** Format a timestamp (ms) as "10:25 PM" */
  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  /** Format a timestamp as a "last seen" style string */
  function formatLastSeen(ts) {
    if (!ts) return "offline";
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = formatTime(ts);
    if (sameDay) return `last seen today at ${time}`;
    if (isYesterday) return `last seen yesterday at ${time}`;
    return `last seen ${d.toLocaleDateString()} at ${time}`;
  }

  /** Format a timestamp for the chat list preview (time or date) */
  function formatListTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return formatTime(ts);

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  /** Basic HTML-escaping to prevent injection through usernames/messages */
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Get initials from a username for the fallback avatar */
  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /** Deterministic pastel color for an avatar background, based on id */
  function colorFromId(id) {
    const palette = [
      "#7C6FE0", "#3FA796", "#E08E45", "#D96C6C",
      "#4C9BE0", "#59B287", "#B37FD9", "#D9A441"
    ];
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % palette.length;
    }
    return palette[Math.abs(hash) % palette.length];
  }

  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function getLS(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function setLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage write failed", e);
    }
  }

  function requireLoginOrRedirect() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      window.location.href = "index.html";
      return null;
    }
    return userId;
  }

  return {
    randomNineDigitId,
    formatTime,
    formatLastSeen,
    formatListTime,
    escapeHtml,
    initials,
    colorFromId,
    debounce,
    getLS,
    setLS,
    requireLoginOrRedirect
  };
})();
