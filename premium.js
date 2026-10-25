/* Karya AI — Pro is temporarily LOCKED for everyone (owner's call: high traffic / server load).
   Every Upgrade / Pro button opens a checkout that can never succeed: method tiles only (no card/UPI fields, no UPI ID, no QR, no links), "Verifying…", then the lock notice. Nothing is collected, stored or sent. */
(function () {
  try { localStorage.removeItem("karya.premium.v1"); localStorage.removeItem("karya.premium.v2"); } catch (e) {} // old demo flags: ignored and cleared
  const WHAT = { video: "video", website: "website", image: "design", design: "design", social: "post", code: "app", email: "email", research: "report", booking: "booking", generic: "result" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isOn = () => false; // premium can never be on while Pro is locked
  const set = () => { sync(); }; // no-op: nothing can turn Pro on
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
.pw-cur{display:inline-block;margin-top:10px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.08);color:var(--muted,#b9b7cf)}
.pw-lockbox{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border-radius:16px;border:1px dashed rgba(251,191,36,.5);background:rgba(251,191,36,.07)}
.pw-lockbox b{font-size:15.5px}.pw-lockbox small{color:var(--muted,#b9b7cf);font-size:13px;line-height:1.45}
.pw-lockbox .pw-btn{margin-top:6px}
.pw-lockmodal{text-align:center;padding:6px 4px 2px}
.pw-lockmodal .pw-lk{font-size:44px;line-height:1;margin:4px 0 10px}
.pw-lockmodal h3{margin:0 0 10px;font-size:19px}
.pw-lockmodal p{margin:0 0 10px;color:var(--muted,#b9b7cf);font-size:14.5px;line-height:1.55}
.pw-lockmodal .pw-free{display:inline-block;margin:4px 0 2px;font-weight:800;color:#34d399}`;
  function ensureStyle() { if (document.getElementById("pw-css")) return; const st = document.createElement("style"); st.id = "pw-css"; st.textContent = css; document.head.appendChild(st); }
  function sync() { document.body.classList.remove("is-premium"); }
  /* Result step on the free plan: no preview at all — the output is removed and a lock box stands in its place. */
  function lock(el, plan, quiet) {
    if (!el) return;
    ensureStyle();
    if (el.querySelector(".pw-lockbox")) return;
    const what = WHAT[(plan && plan.type && plan.type.id) || "generic"] || "result";
    el.innerHTML = `<div class="pw-lockbox"><b>🔒 Task complete ✓ — ${esc(what)} Pro me milega</b><small>Pro abhi temporarily locked hai (high traffic). Free plan pe sirf progress dikhti hai.</small><button type="button" class="pw-btn">⭐ Upgrade</button></div>`;
    el.querySelector(".pw-btn").addEventListener("click", () => open());
    if (!quiet) setTimeout(() => notice(false), 600);
  }
  let sheet = null;
  function close() { if (sheet) sheet.hidden = true; }
  function ensureSheet() {
    ensureStyle();
    if (!sheet) {
      sheet = document.createElement("div"); sheet.className = "pw-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Karya Pro");
      sheet.innerHTML = '<div class="pw-card"></div>';
      sheet.addEventListener("click", (e) => { if (e.target === sheet && !sheet._busy) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet && !sheet.hidden && !sheet._busy) close(); });
      document.body.appendChild(sheet);
    }
    sheet.hidden = false; return sheet.querySelector(".pw-card");
  }
  const top = (t) => `<div class="pw-top"><h3>${t}</h3><button type="button" class="pw-x" aria-label="Close">✕</button></div>`;
  /* Upgrade → checkout tiles → Pay → "Verifying…" → lock notice. It never succeeds and nothing is collected or sent. */
  function open() {
    const c = ensureSheet(); sheet._busy = false;
    const tile = (m, ic, t, sub, sel) => `<div class="pw-opt${sel ? " sel" : ""}" role="radio" tabindex="0" aria-checked="${sel}" data-m="${m}"><span class="ic">${ic}</span><span><b>${t}</b><br><small>${sub}</small></span><span class="rd"></span></div>`;
    c.innerHTML = `${top("Checkout")}
      <div class="pw-sum"><span>Karya Pro · 1 month</span><b>₹99</b></div>
      <div role="radiogroup" aria-label="Payment method">
      ${tile("upi", "UPI", "UPI", "Any UPI app", true)}
      ${tile("card", "💳", "Debit / Credit Card", "Visa, Mastercard, RuPay", false)}
      ${tile("nb", "🏦", "Net Banking", "All major banks", false)}
      ${tile("wallet", "👛", "Wallet", "Paytm, PhonePe, Amazon Pay", false)}
      </div>
      <button type="button" class="pw-btn pw-main" data-pay>Pay ₹99</button>`;
    c.querySelector(".pw-x").addEventListener("click", close);
    const pick = (o) => c.querySelectorAll(".pw-opt").forEach((x) => { const on = x === o; x.classList.toggle("sel", on); x.setAttribute("aria-checked", on); });
    c.querySelectorAll(".pw-opt").forEach((o) => { o.addEventListener("click", () => pick(o)); o.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(o); } }); });
    c.querySelector("[data-pay]").addEventListener("click", () => {
      sheet._busy = true;
      c.innerHTML = `<div class="pw-wait"><div class="pw-spin" aria-hidden="true"></div><b>Verifying payment…</b></div>`;
      setTimeout(() => { sheet._busy = false; notice(true); }, 2000);
    });
  }
  /* The lock notice. afterPay = shown at the end of checkout ("Koi payment nahi liya gaya"). */
  function notice(afterPay) {
    const c = ensureSheet();
    c.innerHTML = `<div class="pw-lockmodal" data-pro-locked><div class="pw-lk" aria-hidden="true">🔒</div>${afterPay
      ? `<h3>Server response closed by owner Aarav Malik</h3><p>High traffic aur server load ki wajah se Pro features temporarily locked hain. <b>Koi payment nahi liya gaya.</b> Server prepare ho raha hai, jaldi wapas aayega.</p>`
      : `<h3>Pro abhi temporarily locked hai</h3><p>High traffic aur server load ki wajah se Karya AI ke owner <b>Aarav Malik</b> ne Pro features ko kuch time ke liye lock kiya hai. Server prepare ho raha hai, jaldi wapas aayega.</p>`}
      <span class="pw-free">Tab tak chat free hai 💬</span>
      <button type="button" class="pw-btn pw-main" data-ok>OK</button></div>`;
    c.querySelector("[data-ok]").addEventListener("click", close);
    setTimeout(() => { const b = c.querySelector("[data-ok]"); if (b) b.focus(); }, 30);
  }
  function init() {
    ensureStyle();
    document.querySelectorAll("[data-prem-reset]").forEach((b) => b.remove());
    sync();
  }
  window.KaryaPremium = { isOn, lock, open, notice, set, sync, locked: true };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
