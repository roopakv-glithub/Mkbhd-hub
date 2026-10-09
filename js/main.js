/* ============================================================
   MKBHD Hub — main.js
   - Mobile nav toggle
   - Toast helper
   - Newsletter + Fan forms: validate → save through the server API → show result
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Mobile nav ---------- */
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("primaryNav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "✕" : "☰";
    });
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.textContent = "☰";
      })
    );
  }

  /* ---------- Toast ---------- */
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
  }

  /* ---------- Status box ---------- */
  function setStatus(el, type, html) {
    if (!el) return;
    el.className = "form-status show " + type;
    el.innerHTML = html;
  }
  function clearStatus(el) {
    if (!el) return;
    el.className = "form-status";
    el.innerHTML = "";
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setErr(input, errEl, msg) {
    if (errEl) errEl.textContent = msg || "";
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }

  /* ---------- Transport: POST to the server and keep a local recovery copy ---------- */
  function saveLocalCopy(payload, serverSaved) {
    try {
      const key = "mkbhdhub_submissions";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push({ ...payload, serverSaved, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev));
      return true;
    } catch {
      return false;
    }
  }

  async function deliver(payload) {
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      let result = {};
      try { result = await response.json(); } catch { /* A malformed response is reported below. */ }
      if (!response.ok) throw new Error(result.error || "The server could not save this entry.");
      return { locallySaved: saveLocalCopy(payload, true) };
    } catch (error) {
      error.locallySaved = saveLocalCopy(payload, false);
      throw error;
    }
  }

  /* ---------- Generic form wiring ---------- */
  function wireForm(cfg) {
    const form = document.getElementById(cfg.formId);
    if (!form) return; // form lives on another page — skip silently
    const status = document.getElementById(cfg.statusId);
    const submitBtn = document.getElementById(cfg.submitId);
    const honey = document.getElementById(cfg.honeyId);
    const originalLabel = submitBtn ? submitBtn.innerHTML : "";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearStatus(status);

      // Honeypot: bots fill it, humans don't
      if (honey && honey.value) { showToast("Thanks! You're on the list."); form.reset(); return; }

      let valid = true;
      for (const rule of cfg.validate()) {
        if (!setErr(rule.input, rule.err, rule.msg)) valid = false;
      }
      const consent = form.querySelector('input[type="checkbox"][required]');
      if (consent && !consent.checked) {
        valid = false;
        showToast("Please tick the consent box to continue.");
      }
      if (!valid) {
        setStatus(status, "error", "<span>⚠</span><span><strong>Almost there</strong> — please fix the highlighted fields.</span>");
        return;
      }

      // Loading state
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Sending…"; }
      setStatus(status, "loading", '<span class="spinner" aria-hidden="true"></span><span>Sending… hold tight.</span>');

      try {
        await deliver(cfg.payload());
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
        form.reset();
        const extra = " <small>Saved privately on the server. This site does not send newsletter emails or submission updates yet. <a href=\"privacy.html\">Privacy &amp; data</a>.</small>";
        setStatus(status, "success", "<span>✓</span><span><strong>" + cfg.successTitle + "</strong><br>" + cfg.successBody + extra + "</span>");
        showToast(cfg.successTitle);
        // Lets widgets (e.g. fan wall) react to new submissions
        document.dispatchEvent(new CustomEvent("mkbhd:submitted", { detail: cfg.formId }));
        status.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (error) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
        const reason = error && error.message ? escapeHtml(error.message) : "Please try again in a moment.";
        const recovery = error && error.locallySaved
          ? "The server did not accept it; a recovery copy remains in this browser."
          : "The server did not accept it, and this browser could not save a recovery copy.";
        setStatus(status, "error", "<span>⚠</span><span><strong>Couldn't save this entry.</strong> " + reason + " " + recovery + "</span>");
        showToast("Couldn't save the entry — please retry.");
      }
    });
  }

  /* ---------- Newsletter (home) ---------- */
  wireForm({
    formId: "newsletterForm", statusId: "newsStatus",
    submitId: "nlSubmit", honeyId: "nlHoney",
    successTitle: "Signup saved! 🎉",
    successBody: "Your newsletter signup is saved. Newsletter email delivery is not set up yet.",
    validate: () => {
      const name = document.getElementById("nlName");
      const email = document.getElementById("nlEmail");
      return [
        { input: name, err: document.getElementById("nlNameErr"),
          msg: name.value.trim().length >= 2 ? "" : "Please enter your name." },
        { input: email, err: document.getElementById("nlEmailErr"),
          msg: emailRe.test(email.value.trim()) ? "" : "Enter a valid email address." },
      ];
    },
    payload: () => ({
      form: "newsletter",
      name: document.getElementById("nlName").value.trim(),
      email: document.getElementById("nlEmail").value.trim(),
      topic: document.getElementById("nlTopic").value,
      consent: document.getElementById("nlConsent").checked,
      honey: document.getElementById("nlHoney").value,
    }),
  });

  /* ---------- Fan form (community) ---------- */
  wireForm({
    formId: "fanForm", statusId: "fanStatus",
    submitId: "fanSubmit", honeyId: "fanHoney",
    successTitle: "Submission received! 🔥",
    successBody: "Your creation is saved privately for review. This site does not send submission updates yet.",
    validate: () => {
      const n = document.getElementById("fanName");
      const em = document.getElementById("fanEmail");
      const m = document.getElementById("fanMsg");
      return [
        { input: n, err: document.getElementById("fanNameErr"),
          msg: n.value.trim().length >= 2 ? "" : "Please add your name or handle." },
        { input: em, err: document.getElementById("fanEmailErr"),
          msg: emailRe.test(em.value.trim()) ? "" : "Enter a valid email address." },
        { input: m, err: document.getElementById("fanMsgErr"),
          msg: m.value.trim().length >= 10 ? "" : "Tell us a little more (10+ characters)." },
      ];
    },
    payload: () => ({
      form: "fan-submission",
      name: document.getElementById("fanName").value.trim(),
      email: document.getElementById("fanEmail").value.trim(),
      type: document.getElementById("fanType").value,
      message: document.getElementById("fanMsg").value.trim(),
      consent: document.getElementById("fanConsent").checked,
      honey: document.getElementById("fanHoney").value,
    }),
  });

  /* ---------- Scroll reveal (progressive enhancement) ---------- */
  (function () {
    const els = document.querySelectorAll(".card, .panel, .t-item, .cta-banner");
    if (!("IntersectionObserver" in window)) return; // without IO, content stays visible
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.1 });
    els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  })();

  /* ---------- Animated hero counters ---------- */
  (function () {
    const nums = document.querySelectorAll("[data-count]");
    if (!nums.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = (el) => {
      const target = parseFloat(el.getAttribute("data-count"));
      const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      const suffix = el.getAttribute("data-suffix") || "";
      if (reduced || !isFinite(target)) { el.textContent = target.toFixed(decimals) + suffix; return; }
      const dur = 1200, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      nums.forEach((el) => io.observe(el));
    } else { nums.forEach(run); }
  })();

  /* ---------- Smartphone Awards countdown ---------- */
  (function () {
    const box = document.getElementById("awardsCountdown");
    if (!box) return;
    const live = document.getElementById("awardsLive");
    const target = new Date("2026-12-18T17:00:00Z").getTime();
    const d = document.getElementById("cd-d"), h = document.getElementById("cd-h"),
          m = document.getElementById("cd-m"), s = document.getElementById("cd-s");
    const pad = (n) => String(n).padStart(2, "0");
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        box.classList.add("hide");
        if (live) live.classList.remove("hide");
        return;
      }
      if (d) d.textContent = Math.floor(diff / 864e5);
      if (h) h.textContent = pad(Math.floor(diff / 36e5) % 24);
      if (m) m.textContent = pad(Math.floor(diff / 6e4) % 60);
      if (s) s.textContent = pad(Math.floor(diff / 1e3) % 60);
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ---------- Video filter chips ---------- */
  (function () {
    const chips = document.querySelectorAll(".chip[data-filter]");
    const grid = document.getElementById("videoGrid");
    if (!chips.length || !grid) return;
    const cards = grid.querySelectorAll(".card[data-cat]");
    chips.forEach((chip) => chip.addEventListener("click", () => {
      chips.forEach((c) => { c.classList.remove("active"); c.setAttribute("aria-pressed", "false"); });
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");
      const f = chip.getAttribute("data-filter");
      cards.forEach((card) => {
        card.classList.toggle("hide", f !== "all" && card.getAttribute("data-cat") !== f);
      });
    }));
  })();

  /* ---------- Blind camera-test poll ---------- */
  const POLL_KEY = "mkbhdhub_poll";
  (function () {
    const clearButton = document.getElementById("clearLocalData");
    const status = document.getElementById("localDataStatus");
    if (!clearButton || !status) return;
    clearButton.addEventListener("click", async () => {
      if (!window.confirm("Clear this browser's saved entries and remove its server submissions and poll vote?")) return;
      clearButton.disabled = true;
      status.textContent = "Clearing saved data…";
      try {
        const submissionsResponse = await fetch("/api/delete-submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const submissionsResult = await submissionsResponse.json();
        if (!submissionsResponse.ok) throw new Error(submissionsResult.error || "Couldn't remove server submissions.");

        const pollResponse = await fetch("/api/poll", { method: "DELETE" });
        const pollResult = await pollResponse.json();
        if (!pollResponse.ok) throw new Error(pollResult.error || "Couldn't remove the server poll vote.");

        localStorage.removeItem("mkbhdhub_submissions");
        localStorage.removeItem(POLL_KEY);
        status.textContent = "Your saved form entries and poll vote have been cleared from this browser and the server.";
      } catch (error) {
        status.textContent = (error && error.message ? error.message : "Couldn't clear saved data.") +
          " Local data was kept; please try again after the server is available.";
      } finally {
        clearButton.disabled = false;
      }
    });
  })();
  function renderPoll(poll) {
    const root = document.getElementById("blindPoll");
    if (!root || !poll) return;
    const total = poll.votes.A + poll.votes.B;
    ["A", "B"].forEach((k) => {
      const pct = total ? Math.round((poll.votes[k] / total) * 100) : 0;
      const fill = document.getElementById("fill" + k);
      const label = document.getElementById("pct" + k);
      const btn = root.querySelector('[data-vote="' + k + '"]');
      if (fill) fill.style.width = pct + "%";
      if (label) label.textContent = pct + "% · " + poll.votes[k].toLocaleString() + " votes";
      if (btn) {
        btn.classList.toggle("mine", poll.mine === k);
        btn.textContent = poll.mine === k ? "✓ Your pick — tap to change" : "Vote " + k;
        btn.disabled = false;
      }
    });
    const totalEl = document.getElementById("pollTotal");
    if (totalEl) totalEl.textContent = total.toLocaleString() + " votes from all visitors" +
      (poll.mine ? " · you voted " + poll.mine : " · tap a button to vote");
  }
  (function () {
    const root = document.getElementById("blindPoll");
    if (!root) return;
    const totalEl = document.getElementById("pollTotal");
    const buttons = root.querySelectorAll("[data-vote]");
    let currentPoll = null;
    let pending = false;
    buttons.forEach((button) => { button.disabled = true; });
    if (totalEl) totalEl.textContent = "Loading shared poll results…";

    fetch("/api/poll", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The shared poll is unavailable.");
        currentPoll = result;
        renderPoll(currentPoll);
      })
      .catch((error) => {
        if (totalEl) totalEl.textContent = error.message || "The shared poll is unavailable right now.";
      });

    root.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-vote]");
      if (!btn || !currentPoll || pending) return;
      const choice = btn.getAttribute("data-vote");
      const nextChoice = currentPoll.mine === choice ? null : choice;
      pending = true;
      buttons.forEach((button) => { button.disabled = true; });
      if (totalEl) totalEl.textContent = "Saving your vote…";
      try {
        const response = await fetch("/api/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ choice: nextChoice }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The server couldn't save your vote.");
        currentPoll = result;
        renderPoll(currentPoll);
        showToast(nextChoice ? "Your vote was counted." : "Your vote was removed.");
      } catch (error) {
        if (totalEl) totalEl.textContent = error.message || "Couldn't save your vote. Please try again.";
        buttons.forEach((button) => { button.disabled = false; });
      } finally {
        pending = false;
      }
    });
  })();

  /* ---------- Fan wall (renders local fan submissions, XSS-safe) ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function renderFanWall() {
    const wall = document.getElementById("fanWall");
    if (!wall) return;
    let items = [];
    try { items = JSON.parse(localStorage.getItem("mkbhdhub_submissions") || "[]"); } catch (_) {}
    const fans = items.filter((x) => x && x.form === "fan-submission").slice(-6).reverse();
    if (!fans.length) {
      wall.innerHTML = '<div class="fan-empty">No submissions on this device yet — be the first via the form above. 👆</div>';
      return;
    }
    wall.innerHTML = fans.map((f) => {
      const when = f.at ? new Date(f.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
      const label = f.serverSaved === false ? "Pending · " + (f.type || "fan") : (f.type || "fan");
      return '<article class="fan-item"><span class="tag">' + escapeHtml(label) + "</span><p>" +
        escapeHtml(f.message || "") + '</p><div class="fan-meta"><span><strong>' +
        escapeHtml(f.name || "Anonymous") + "</strong></span><span>" + escapeHtml(when) + "</span></div></article>";
    }).join("");
  }
  renderFanWall();
  document.addEventListener("mkbhd:submitted", (e) => { if (e.detail === "fanForm") renderFanWall(); });

  /* ---------- Back-to-top button (injected, enhancement only) ---------- */
  (function () {
    const btn = document.createElement("button");
    btn.id = "toTop";
    btn.textContent = "↑";
    btn.setAttribute("aria-label", "Back to top");
    document.body.appendChild(btn);
    const onScroll = () => btn.classList.toggle("show", window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  })();
})();
