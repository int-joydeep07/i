/* ============================================================
   ui.js
   Generic UI primitives reused across home.js / chat.js / etc:
   toasts, modal dialogs, side panels, bottom sheets.
   ============================================================ */

const UI = (() => {

  let toastTimer = null;

  function toast(message, type = "info", duration = 2600) {
    let host = document.getElementById("toastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = message;
    host.appendChild(el);

    requestAnimationFrame(() => el.classList.add("toast--show"));

    setTimeout(() => {
      el.classList.remove("toast--show");
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  function openPanel(panelEl) {
    if (!panelEl) return;
    document.body.classList.add("no-scroll");
    panelEl.classList.add("panel--open");
    const backdrop = ensureBackdrop();
    backdrop.classList.add("backdrop--show");
    backdrop.onclick = () => closePanel(panelEl);
  }

  function closePanel(panelEl) {
    if (!panelEl) return;
    panelEl.classList.remove("panel--open");
    const backdrop = document.getElementById("uiBackdrop");
    if (backdrop) backdrop.classList.remove("backdrop--show");
    document.body.classList.remove("no-scroll");
  }

  function ensureBackdrop() {
    let backdrop = document.getElementById("uiBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "uiBackdrop";
      backdrop.className = "backdrop";
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  /** Simple confirm dialog returning a Promise<boolean> */
  function confirmDialog(message, { confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay modal-overlay--show";
      overlay.innerHTML = `
        <div class="modal-box">
          <p class="modal-message">${Utils.escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn--ghost" data-action="cancel">${cancelText}</button>
            <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-action="confirm">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      overlay.querySelector('[data-action="cancel"]').onclick = () => {
        overlay.remove();
        resolve(false);
      };
      overlay.querySelector('[data-action="confirm"]').onclick = () => {
        overlay.remove();
        resolve(true);
      };
    });
  }

  /** Simple prompt dialog returning a Promise<string|null> */
  function promptDialog(message, { placeholder = "", initialValue = "" } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay modal-overlay--show";
      overlay.innerHTML = `
        <div class="modal-box">
          <p class="modal-message">${Utils.escapeHtml(message)}</p>
          <input type="text" class="modal-input" placeholder="${Utils.escapeHtml(placeholder)}" value="${Utils.escapeHtml(initialValue)}" />
          <div class="modal-actions">
            <button class="btn btn--ghost" data-action="cancel">Cancel</button>
            <button class="btn btn--primary" data-action="ok">Save</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector(".modal-input");
      input.focus();
      input.select();

      const close = (val) => {
        overlay.remove();
        resolve(val);
      };

      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('[data-action="cancel"]').onclick = () => close(null);
      overlay.querySelector('[data-action="ok"]').onclick = () => close(input.value.trim());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") close(input.value.trim());
        if (e.key === "Escape") close(null);
      });
    });
  }

  function setLoading(buttonEl, isLoading, loadingText = "Please wait…") {
    if (!buttonEl) return;
    if (isLoading) {
      buttonEl.dataset.originalText = buttonEl.textContent;
      buttonEl.textContent = loadingText;
      buttonEl.disabled = true;
    } else {
      buttonEl.textContent = buttonEl.dataset.originalText || buttonEl.textContent;
      buttonEl.disabled = false;
    }
  }

  return { toast, openPanel, closePanel, confirmDialog, promptDialog, setLoading };
})();
