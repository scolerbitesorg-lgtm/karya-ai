/* Karya AI — DEMO premium paywall. No real payment: nothing is sent anywhere, no UPI ID, no payment link. */
(function () {
  const KEY = "karya.premium.v1";
  const WHAT = { video: "video", website: "website", image: "design", design: "design", social: "post", code: "app", email: "email", research: "report", booking: "booking", generic: "result" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isOn = () => { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  const set = (v) => { try { v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch (e) {} sync(); document.dispatchEvent(new CustomEvent("karya-premium", { detail: { on: v } })); };
  const css = `
.pw-wrap{position:relative}
.pw-wrap.pw-locked>.pw-inner{filter:blur(7px);opacity:.55;pointer-events:none;user-select:none}
.pw-lock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:14px;border-radius:16px;background:linear-gradient(180deg,rgba(124,92,255,.10),rgba(15,15,30,.35));z-index:2}
.pw-wrap:not(.pw-locked)>.pw-lock{display:none}
.pw-lock b{font-size:15px;line-height:1.3;color:var(--text,#fff);text-shadow:0 1px 8px rgba(0,0,0,.35)}
.pw-lock small{font-size:12px;color:var(--muted,#b9b7cf)}
.pw-btn{border:0;border-radius:12px;padding:10px 18px;font-weight:800;font-size:14px;color:#1b1300;background:linear-gradient(135deg,#ffd76a,#ffb020);box-shadow:0 6px 20px rgba(255,176,32,.35);cursor:pointer}
.pw-wrap.pw-locked{min-height:150px}
.prem-badge{display:none;align-items:center;gap:4px;font-size:12px;font-weight:800;padding:4px 10px;border-radius:99px;color:#1b1300;background:linear-gradient(135deg,#ffd76a,#ffb020);white-space:nowrap}
body.is-premium .prem-badge{display:inline-flex}
@media (max-width:520px){.bar .prem-badge .pb-t{display:none}.bar .prem-badge{padding:4px 8px}}
.prem-badge.sm{font-size:11px;padding:3px 8px;flex:none}
.pw-sheet{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;background:rgba(6,6,14,.6);backdrop-filter:blur(4px)}
.pw-sheet[hidden]{display:none}
.pw-card{width:min(440px,100%);max-height:92vh;overflow:auto;background:var(--bg2,#14142a);color:var(--text,#fff);border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:22px 22px 0 0;padding:20px 18px 22px;box-shadow:0 -10px 40px rgba(0,0,0,.4);font-family:inherit}
@media (min-width:700px){.pw-sheet{align-items:center}.pw-card{border-radius:22px}}
.pw-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.pw-top h3{margin:0;font-size:18px}
.pw-x{border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;padding:4px 8px}
.pw-plan{border-radius:18px;padding:16px;background:linear-gradient(135deg,rgba(255,215,106,.16),rgba(124,92,255,.18));border:1px solid rgba(255,200,80,.45)}
.pw-plan .pp-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.pw-plan .pp-h b{font-size:17px}
.pw-price{font-size:24px;font-weight:900}.pw-price small{font-size:12px;font-weight:600;opacity:.75}
.pw-plan ul{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:7px;font-size:14px}
.pw-plan li::before{content:"✓ ";color:#34d399;font-weight:900}
.pw-demo{display:block;margin-top:12px;font-size:12px;color:var(--muted,#b9b7cf);text-align:center}
.pw-main{width:100%;margin-top:14px;padding:13px;font-size:15px}
.pw-sum{display:flex;justify-content:space-between;font-size:14px;padding:12px 14px;border-radius:14px;background:var(--panel,rgba(255,255,255,.05));border:1px solid var(--line,rgba(255,255,255,.08))}
.pw-opt{display:flex;align-items:center;gap:10px;margin-top:10px;padding:12px 14px;border-radius:14px;border:1.5px solid var(--line2,rgba(255,255,255,.15));background:var(--panel,rgba(255,255,255,.04));font-size:14px;cursor:pointer}
.pw-opt.sel{border-color:#7c5cff;box-shadow:0 0 0 3px rgba(124,92,255,.18)}
.pw-opt.dis{opacity:.45;cursor:not-allowed}
.pw-opt .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#fff;color:#111;font-weight:900;font-size:11px}
.pw-opt .rd{margin-left:auto;width:18px;height:18px;border-radius:50%;border:2px solid var(--line2,#888)}
.pw-opt.sel .rd{border:5px solid #7c5cff}
.pw-wait{text-align:center;padding:26px 6px 10px}
.pw-spin{width:46px;height:46px;margin:0 auto 14px;border-radius:50%;border:4px solid rgba(124,92,255,.25);border-top-color:#7c5cff;animation:pwspin .8s linear infinite}
@keyframes pwspin{to{transform:rotate(360deg)}}
.pw-ok{font-size:44px;line-height:1;margin-bottom:8px}
.pw-wait b{display:block;font-size:17px}.pw-wait small{display:block;margin-top:6px;color:var(--muted,#b9b7cf)}
@media (prefers-reduced-motion:reduce){.pw-spin{animation-duration:2.4s}}
.pw-chatfree{margin:0 0 12px;padding:10px 12px;border-radius:14px;text-align:center;font-weight:800;font-size:15px;color:#34d399;background:rgba(52,211,153,.10);border:1px solid rgba(52,211,153,.35)}
.pw-plan+.pw-plan{margin-top:12px}
.pw-plan.pw-free{background:var(--panel,rgba(255,255,255,.04));border:1px solid var(--line2,rgba(255,255,255,.14))}
.pw-plan li.no::before{content:"✕ ";color:#f87171}
.pw-plan li.no{opacity:.75}
.pw-cur{display:inline-block;margin-top:10px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.08);color:var(--muted,#b9b7cf)}`;
  function ensureStyle() { if (document.getElementById("pw-css")) return; const st = document.createElement("style"); st.id = "pw-css"; st.textContent = css; document.head.appendChild(st); }
  function sync() {
    document.body.classList.toggle("is-premium", isOn());
    document.querySelectorAll(".pw-wrap").forEach((w) => w.classList.toggle("pw-locked", !isOn()));
  }
  /* Wrap a result element: blurred + lock overlay until premium. */
  function lock(el, plan) {
    if (!el) return;
    ensureStyle();
    if (el.querySelector(":scope > .pw-wrap")) { sync(); return; }
    const what = WHAT[(plan && plan.type && plan.type.id) || "generic"] || "result";
    const wrap = document.createElement("div"); wrap.className = "pw-wrap";
    const inner = document.createElement("div"); inner.className = "pw-inner";
    while (el.firstChild) inner.appendChild(el.firstChild);
    wrap.appendChild(inner);
    const ov = document.createElement("div"); ov.className = "pw-lock";
    ov.innerHTML = `<b>⭐ Upgrade to Premium to get your ${esc(what)}</b><small>Task complete ✓ · result Premium me unlock hoga</small><button type="button" class="pw-btn">⭐ Upgrade</button>`;
    ov.querySelector(".pw-btn").addEventListener("click", () => open());
    wrap.appendChild(ov); el.appendChild(wrap);
    sync();
  }
  let sheet = null;
  function close() { if (sheet) sheet.hidden = true; }
  function open() {
    ensureStyle();
    if (!sheet) {
      sheet = document.createElement("div"); sheet.className = "pw-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Karya Premium");
      sheet.innerHTML = '<div class="pw-card"></div>';
      sheet.addEventListener("click", (e) => { if (e.target === sheet && !sheet._busy) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet && !sheet.hidden && !sheet._busy) close(); });
      document.body.appendChild(sheet);
    }
    planStep(); sheet.hidden = false;
  }
  const card = () => sheet.querySelector(".pw-card");
  const top = (t) => `<div class="pw-top"><h3>${t}</h3><button type="button" class="pw-x" aria-label="Close">✕</button></div>`;
  const wireX = () => { const x = card().querySelector(".pw-x"); if (x) x.addEventListener("click", close); };
  function planStep() {
    const pro = isOn();
    card().innerHTML = `${top("⭐ Karya Plans")}
      <div class="pw-chatfree">Chat hamesha free hai 💬</div>
      <div class="pw-plan pw-free"><div class="pp-h"><b>Free trial</b><span class="pw-price">₹0</span></div>
      <ul><li>Task progress dekh sakte ho</li><li>Free &amp; limited chat</li><li class="no">Final result locked 🔒</li></ul>
      ${pro ? "" : '<span class="pw-cur">Current plan</span>'}</div>
      <div class="pw-plan pw-pro"><div class="pp-h"><b>⭐ Pro</b><span class="pw-price">₹99<small>/month (demo)</small></span></div>
      <ul><li>Task ka result preview</li><li>Task execute / complete</li><li>Unlimited chat</li></ul>
      ${pro ? '<span class="pw-cur">Current plan ✓</span>' : ""}</div>
      ${pro ? '<button type="button" class="pw-btn pw-main" data-done>Done</button>' : '<button type="button" class="pw-btn pw-main" data-next>Get Pro — ₹99 →</button>'}
      <small class="pw-demo">Demo payment — koi paisa nahi katega</small>`;
    wireX();
    const nx = card().querySelector("[data-next]"); if (nx) nx.addEventListener("click", payStep);
    const dn = card().querySelector("[data-done]"); if (dn) dn.addEventListener("click", close);
  }
  function payStep() {
    card().innerHTML = `${top("Checkout")}
      <div class="pw-sum"><span>Karya Pro · 1 month (demo)</span><b>₹99</b></div>
      <div class="pw-opt sel" role="radio" aria-checked="true"><span class="ic">UPI</span><span><b>UPI</b><br><small>Any UPI app</small></span><span class="rd"></span></div>
      <div class="pw-opt dis" role="radio" aria-checked="false" aria-disabled="true"><span class="ic">💳</span><span><b>Card</b><br><small>Coming soon</small></span><span class="rd"></span></div>
      <button type="button" class="pw-btn pw-main" data-pay>Pay ₹99</button>
      <small class="pw-demo">Demo payment — koi paisa nahi katega</small>`;
    wireX(); card().querySelector("[data-pay]").addEventListener("click", verify);
  }
  function verify() {
    sheet._busy = true;
    card().innerHTML = `<div class="pw-wait"><div class="pw-spin" aria-hidden="true"></div><b>Verifying payment…</b><small>Demo — koi paisa nahi katega</small></div>`;
    setTimeout(() => {
      card().innerHTML = `<div class="pw-wait"><div class="pw-ok">✅</div><b>Payment verified (demo)</b><small>⭐ Pro unlocked</small></div>`;
      set(true);
      setTimeout(() => { sheet._busy = false; close(); }, 1300);
    }, 2500);
  }
  function badge(host, before) {
    if (!host || host.querySelector(".prem-badge")) return;
    const b = document.createElement("span"); b.className = "prem-badge"; b.title = "Premium"; b.innerHTML = '⭐<span class="pb-t"> Premium</span>';
    host.insertBefore(b, before ? host.firstChild : null);
  }
  function init() {
    ensureStyle();
    badge(document.querySelector(".bar-actions"), true);
    badge(document.querySelector(".top-actions"), true);
    const wl = document.getElementById("wsLive");
    if (wl && !wl.parentNode.querySelector(".prem-badge")) { const b = document.createElement("span"); b.className = "prem-badge sm"; b.textContent = "⭐ Pro"; b.title = "Premium"; wl.parentNode.insertBefore(b, wl); }
    document.querySelectorAll("[data-prem-reset]").forEach((b) => b.addEventListener("click", () => { set(false); b.textContent = "Premium reset ✓"; setTimeout(() => { b.textContent = "Reset premium (demo)"; }, 1500); }));
    sync();
    window.addEventListener("storage", (e) => { if (e.key === KEY) sync(); });
  }
  window.KaryaPremium = { isOn, lock, open, set, sync };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
