(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- storage ---------- */
const LS = { settings: "karya.settings.v1", history: "karya.history.v1" };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const DEFAULTS = { name: "Karya", key: "", model: "openai/gpt-oss-120b", speed: "1" };
let settings = Object.assign({}, DEFAULTS, load(LS.settings, {}));
let history = load(LS.history, []);
const qsSpeed = parseFloat(new URLSearchParams(location.search).get("speed"));
const speed = () => (qsSpeed > 0 ? qsSpeed : (parseFloat(settings.speed) || 1) * (typeof modelBoost === "function" ? modelBoost() : 1));
const workerName = () => (settings.name || "Karya").trim() || "Karya";

function applyTheme() { if (!document.documentElement) return; document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "dark"); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", settings.theme === "light" ? "#f6f6fb" : "#07070d"); }
applyTheme();
const modelName = () => ({ ultra: "Karya Ultra 4.2", pro: "Karya Pro 4", flash: "Karya Flash", vision: "Karya Vision X" }[settings.workerModel || "ultra"] || "Karya Ultra 4.2");
const modelBoost = () => (settings.workerModel === "flash" ? 1.5 : 1);

/* ---------- seeded random ---------- */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function art(seed, i = 0) {
  const r = rng(hash(seed + ":" + i));
  const h1 = Math.floor(r() * 360), h2 = (h1 + 40 + Math.floor(r() * 120)) % 360, h3 = (h1 + 180 + Math.floor(r() * 60)) % 360;
  const x = Math.floor(r() * 100), y = Math.floor(r() * 100), x2 = Math.floor(r() * 100), y2 = Math.floor(r() * 100);
  return `background:radial-gradient(circle at ${x}% ${y}%, hsla(${h1},90%,62%,.95), transparent 45%),radial-gradient(circle at ${x2}% ${y2}%, hsla(${h2},85%,55%,.9), transparent 50%),linear-gradient(${Math.floor(r() * 360)}deg, hsl(${h3},60%,14%), hsl(${h2},70%,22%))`;
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randId = (r, n, set = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789_-") => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join("");

/* ---------- task understanding ---------- */
const TYPES = [
  { id: "video", label: "Video · YouTube", icon: "🎬", re: /\b(vid(eo|oe|io)s?|youtube|yt|reels?|shorts?|vlog|animation|trailer|film)\b/i },
  { id: "image", label: "Design · Image", icon: "🎨", re: /\b(posters?|logos?|thumbnails?|banners?|images?|photos?|pics?|picture|flyers?|wallpaper|illustration|art|design)\b/i },
  { id: "social", label: "Social media", icon: "📣", re: /\b(instagram|insta|tweets?|twitter|x thread|linkedin|facebook|captions?|posts?|hashtags?|social)\b/i },
  { id: "website", label: "Website", icon: "🌐", re: /\b(websites?|site|landing|portfolio|webpage|web\s?page|web|blog)\b/i },
  { id: "code", label: "Code · App", icon: "🧩", re: /\b(app|apps|code|script|bot|api|python|javascript|react|android|ios|software|program|extension|game)\b/i },
  { id: "email", label: "Email", icon: "✉️", re: /\b(e-?mails?|mail|newsletter|outreach|inbox)\b/i },
  { id: "research", label: "Research · Report", icon: "📊", re: /\b(research|report|analy[sz]\w*|compare|comparison|study|notes|summary|summari[sz]e|pdf|market|survey|explain)\b/i },
  { id: "booking", label: "Booking · Shopping", icon: "🛒", re: /\b(book|booking|tickets?|flights?|hotels?|train|buy|order|shop|shopping|cart|amazon|flipkart|reserve|table|cab|uber)\b/i },
];
const HINGLISH = /\b(bana|banao|bnao|bana do|kar do|kr do|karo|kro|mujhe|mere|mera|hai|h|kya|bhai|ke liye|ka|ki|ko|pe|pr|par|aur|dena|chahiye|kaise|tum|kuch|kuchh)\b/i;
function detectType(t) { for (const ty of TYPES) if (ty.re.test(t)) return ty; return { id: "generic", label: "Custom task", icon: "✨" }; }
const STOP = new Set("a an the and or to of for on in at with my me i you your it this that please make create generate build design write upload post send do can could would kindly about video videos vidoe youtube yt website site web app image poster logo email mail report research ek bana banao bnao kar kr do karo kro de dena mujhe mere mera ke ki ka ko liye pe pr par aur or hai h then also using some new best one banake bnake banakar".split(" "));
function extractTopic(t) {
  const clean = t.replace(/\s+/g, " ").trim();
  let m = clean.match(/\btrip to\s+([\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u);
  if (m) return "Trip to " + tidy(m[1]);
  m = clean.match(/\b(?:about|on|regarding|related to|featuring)\s+(.+?)(?:\s+(?:and|then|&|aur|or)\s+|[.,!?;]|$)/i);
  if (m && m[1].split(" ").length <= 9) return tidy(m[1]);
  m = clean.match(/\b(?:ek|a|an)\s+([\p{L}\p{N}' -]{2,40}?)\s+(video|vidoe|website|web|poster|logo|post|report|app|email|reel|thumbnail)\b/iu);
  if (m && m[1].split(" ").length <= 4) { const w = m[1].split(" ").filter((x) => !STOP.has(x.toLowerCase())); if (w.length) return tidy(w.join(" ") + " " + m[2].replace(/vidoe/i, "video")); }
  m = clean.match(/(?:^|\s)(.{3,60}?)\s+(?:par|pe|pr|ke bare me|ke baare mein|ke upar)\b/i);
  if (m) { const w = m[1].split(" ").filter((x) => !STOP.has(x.toLowerCase())); if (w.length) return tidy(w.slice(-4).join(" ")); }
  m = clean.match(/\b(?:for|ke liye)\s+(.+?)(?:\s+(?:and|then|&|aur)\s+|[.,!?;]|$)/i);
  if (m && m[1].split(" ").length <= 7) return tidy(m[1]);
  const words = clean.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return tidy(words.slice(0, 5).join(" ") || "your request");
}
function tidy(s) { s = s.replace(/^(a|an|the|my|our|your)\s+/i, "").replace(/[.,!?;:]+$/, "").trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "project";

/* ---------- plan templates ---------- */
function buildPlan(task, seedKey) {
  const r = rng(hash(task + "|" + seedKey));
  const ty = detectType(task);
  const topic = extractTopic(task);
  const T0 = topic.length > 48 ? topic.slice(0, 46) + "…" : topic;
  const T = ty.id === "generic" && !/\b(?:about|for|on)\b/i.test(task) ? tidy(task.replace(/^(please|pls|plz)\s+/i, "").slice(0, 44)) : T0;
  const slug = slugify(T);
  const S = (name, icon, agent, dur, subs, extra = {}) => Object.assign({ name, icon, agent, dur, subs }, extra);
  let steps, result;
  const short = task.length > 70 ? task.slice(0, 68) + "…" : task;
  const understand = S("Understanding your task", "🧠", "Planner · Ultra", 3, [
    `Parsed request (${HINGLISH.test(task) ? "Hinglish → EN" : "EN"}): “${short}”`,
    `Intent: ${ty.label} · Topic: ${T}`,
    `Assembled a team of specialised agents`,
  ], { logs: ["tokenizing request", "loading workspace memory (14 prefs)", "plan graph compiled ✓"] });

  switch (ty.id) {
    case "video": {
      const hooks = [`What nobody tells you about ${T}…`, `${T} in 60 seconds 🔥`, `This changed how I see ${T}`, `The untold story of ${T}`];
      const title = pick(r, hooks);
      const vid = randId(r, 11);
      steps = [understand,
        S("Researching & outlining", "🔎", "Research agent", 4, [`Scanned ${14 + Math.floor(r() * 20)} top videos on “${T}”`, `Found ${4 + Math.floor(r() * 5)} high-retention hooks`, "Outline: hook → 3 story beats → CTA"], { logs: ["yt.search(trending, region=IN)", "retention curve analysis done", "outline locked"] }),
        S("Writing the script", "✍️", "Script writer", 4, [`Hook: “${title}”`, `Script v2 · ${120 + Math.floor(r() * 60)} words · 58 s read`, "Tone: cinematic, energetic"], { logs: ["draft v1 → critic score 7.9", "rewrite v2 → critic score 9.4 ✓"] }),
        S("Generating AI video prompts", "🎬", "Prompt engineer", 4, ["6 shot prompts with camera + lighting", "Style lock: cinematic 35mm, teal-orange", "Negative prompts: blur, text artifacts"], { art: "prompts", logs: ["prompt.optimize(model=karya-motion-4)", "seed bank reserved: 6"] }),
        S("Generating scenes", "🎞️", "Motion model · Ultra", 8, ["Rendering 6 scenes @ 1080p60", "Temporal consistency pass", "All scenes approved by critic"], { art: "scenes", logs: ["GPU lane: priority (A100 ×4)", "scene batch 1/2 queued", "scene batch 2/2 queued", "upscaling 2× ✓"] }),
        S("Voiceover & music", "🎙️", "Audio agent", 4, ["Voice: Arjun (neural, warm, bilingual)", "Score: Epic Rise · 120 BPM", "Auto-ducking · loudness −14 LUFS"], { logs: ["tts.synthesize 58.2 s", "beat-sync markers: 24"] }),
        S("Preview ready", "👀", "Editor agent", 3, ["Cuts synced to beat markers", "Captions EN + HI burned in", "Preview generated for review"], { art: "preview", logs: ["timeline assembled: 6 clips, 2 transitions", "preview.mp4 (720p) ready"] }),
        S("Rendering final video", "🖥️", "Render farm", 5, ["Encoding 1080p60 · H.264 · 12 Mbps", "Color grade: Teal & Orange LUT", "Final: 0:59 · 86.4 MB"], { logs: ["frame 1416/3540", "frame 3540/3540", "mux audio ✓"] }),
        S("Thumbnail & SEO", "🏷️", "Growth agent", 3, ["3 thumbnails A/B → picked CTR 11.8%", "Title, description, 15 tags", "Chapters added"], { art: "seo", logs: ["keyword volume fetched", "thumbnail_b.png selected"] }),
        S("Uploading to YouTube", "⬆️", "YouTube connector", 5, ["Uploading 86.4 MB", "Processing on YouTube", "Visibility: Public · Made for kids: No"], { art: "upload", logs: ["oauth ✓ channel linked", "resumable upload session opened", "processing HD…", "published ✓"] }),
      ];
      result = { icon: "▶️", title: "Video published on YouTube", sub: `“${title}” · 0:59 · 1080p60`, link: `youtu.be/${vid}`, kind: "yt", ytTitle: title };
      break;
    }
    case "website": {
      steps = [understand,
        S("Mapping requirements", "📋", "Product agent", 3, ["Pages: Home, About, Services, Contact", "Audience & goals defined", "SEO keywords: 12"], { logs: ["competitor scan: 9 sites"] }),
        S("Sitemap & wireframes", "🧭", "UX agent", 4, ["Sitemap: 4 pages, 18 sections", "Mobile-first wireframes", "Conversion path mapped"], { logs: ["wireframe v1 → v2"] }),
        S("Design system", "🎨", "Design agent", 4, ["Palette + type scale generated", "28 components", "Dark & light themes"], { art: "images", logs: ["contrast AA ✓", "tokens exported"] }),
        S("Writing copy", "✍️", "Copywriter", 3, [`Headline: “${T}, done right.”`, "1,240 words across pages", "Readability grade 7"], { logs: ["tone: confident, friendly"] }),
        S("Building pages", "🛠️", "Frontend engineer", 7, ["Generated 4 pages · 31 components", "Animations & interactions", "Forms wired"], { art: "code", logs: ["npm run build", "bundle 84 KB gz", "0 type errors"] }),
        S("Testing", "🧪", "QA agent", 4, ["Lighthouse: 99 / 100 / 100 / 100", "Tested on 14 devices", "0 broken links"], { logs: ["playwright: 42 passed"] }),
        S("Deploying to the edge", "🚀", "DevOps agent", 4, ["SSL certificate issued", "Deployed to 32 edge regions", "Analytics enabled"], { art: "upload", logs: ["dns propagated", "cdn warm ✓"] }),
      ];
      result = { icon: "🌐", title: "Website is live", sub: `${T} · 4 pages · Lighthouse 99`, link: `${slug}.karya.site`, kind: "link" };
      break;
    }
    case "image": {
      steps = [understand,
        S("Analysing the brief", "🧾", "Creative director", 3, [`Subject: ${T}`, "Format: 4:5 + 16:9 + 1:1", "Mood: bold, premium"], { logs: ["brand memory loaded"] }),
        S("Building a moodboard", "🧷", "Research agent", 3, ["Pulled 36 references", "Palette extracted", "Typography paired"], { logs: ["style clustering done"] }),
        S("Writing image prompts", "🪄", "Prompt engineer", 3, ["4 prompt variants", "Lighting + lens specified", "Text layout reserved"], { art: "prompts", logs: ["prompt.optimize(model=karya-vision-5)"] }),
        S("Generating variants", "🎨", "Image model · Ultra", 7, ["4 variants rendered", "Critic picked best 2", "Text rendered crisp"], { art: "gallery", logs: ["GPU lane: priority", "variant 4/4 ✓"] }),
        S("Upscaling & retouch", "🔬", "Retouch agent", 4, ["Upscaled 4× to 4096 px", "Face & detail restore", "Colour balanced"], { logs: ["denoise ✓", "sharpen ✓"] }),
        S("Exporting", "📦", "Export agent", 3, ["PNG, JPG, PDF (print, CMYK)", "Social sizes auto-cropped", "Saved to your drive"], { logs: ["zip 18.2 MB"] }),
      ];
      result = { icon: "🖼️", title: "Designs ready", sub: `${T} · 4 variants · 4K`, link: `karya.ai/d/${randId(r, 8)}`, kind: "link" };
      break;
    }
    case "social": {
      steps = [understand,
        S("Analysing your audience", "📈", "Growth agent", 3, ["Best posting time: 7:30 PM IST", "Top hashtags in your niche: 24", "Competitor hooks reviewed"], { logs: ["insights.fetch(30d)"] }),
        S("Writing hooks & captions", "✍️", "Copywriter", 4, [`Hook: “Stop scrolling — ${T} explained”`, "Caption + CTA written", "Hashtags: 15 (mixed reach)"], { art: "post", logs: ["3 variants → picked v2"] }),
        S("Designing the creative", "🎨", "Design agent", 5, ["Carousel: 5 slides", "Brand colours applied", "Alt-text written"], { art: "gallery", logs: ["render slides 5/5 ✓"] }),
        S("Scheduling", "🗓️", "Scheduler", 3, ["Queued for 7:30 PM IST", "Cross-post: Instagram, LinkedIn, X", "First comment pinned"], { logs: ["calendar slot reserved"] }),
        S("Publishing", "🚀", "Social connector", 4, ["Posted to 3 platforms", "Engagement tracking on", "Auto-reply to DMs enabled"], { art: "upload", logs: ["post_id received ×3"] }),
      ];
      result = { icon: "📣", title: "Post is live", sub: `${T} · 3 platforms`, link: `instagram.com/p/${randId(r, 11)}`, kind: "link" };
      break;
    }
    case "code": {
      steps = [understand,
        S("Writing the spec", "📐", "Architect", 3, ["14 user stories", "Data model: 5 entities", "API: 9 endpoints"], { logs: ["spec.md generated"] }),
        S("Planning architecture", "🏗️", "Architect", 3, ["Stack: React + Node + Postgres", "Auth, storage, queues", "CI/CD pipeline"], { logs: ["diagram exported"] }),
        S("Writing the code", "⌨️", "Engineer agents ×3", 8, ["2,184 lines across 37 files", "Typed end-to-end", "Docs inline"], { art: "code", logs: ["git init", "commit: feat: core modules", "commit: feat: ui"] }),
        S("Running tests", "🧪", "QA agent", 4, ["128 tests passed · 0 failed", "Coverage 94%", "Security scan: 0 issues"], { logs: ["vitest run", "npm audit ✓"] }),
        S("Building & shipping", "📦", "DevOps agent", 4, ["Production build 1.2 MB", "Pushed to GitHub", "Deployed preview"], { art: "upload", logs: ["git push origin main", "deploy ✓"] }),
      ];
      result = { icon: "🧩", title: "App shipped", sub: `${T} · 37 files · 128 tests passing`, link: `github.com/karya-builds/${slug}`, kind: "link" };
      break;
    }
    case "email": {
      steps = [understand,
        S("Gathering context", "📥", "Inbox agent", 3, ["Read 12 related threads", "Recipients list: 128", "Tone from your past emails"], { logs: ["gmail.search ✓"] }),
        S("Drafting the email", "✍️", "Writer", 4, [`Subject: ${T} — quick update`, "Draft v2 · 164 words", "Personalised first lines"], { art: "email", logs: ["draft v1 → v2"] }),
        S("Tone & grammar check", "✅", "Editor", 3, ["Clarity score 96", "Spam score 0.2 (excellent)", "Links verified"], { logs: ["mail-tester ✓"] }),
        S("Sending", "📤", "Mail connector", 4, ["Sent in 4 batches", "Open tracking on", "Follow-up scheduled (3 days)"], { art: "upload", logs: ["smtp batch 4/4 ✓"] }),
      ];
      result = { icon: "✉️", title: "Email sent", sub: "Delivered to 128 recipients · 0 bounces", link: `mail.karya.ai/c/${randId(r, 8)}`, kind: "link" };
      break;
    }
    case "research": {
      steps = [understand,
        S("Planning search queries", "🧭", "Research lead", 3, ["18 queries across 4 angles", "Languages: EN + HI", "Date range: last 24 months"], { art: "prompts", logs: ["query graph built"] }),
        S("Searching sources", "🌍", "Search agents ×4", 6, [`Found ${40 + Math.floor(r() * 20)} relevant sources`, "Govt data, journals, news", "Paywalls bypassed via library access"], { art: "sources", logs: ["crawl 1/3", "crawl 3/3 ✓"] }),
        S("Reading & extracting", "📖", "Reader agents", 5, ["Extracted 312 facts", "Built 6 data tables", "Quotes with citations"], { logs: ["dedupe: 41 merged"] }),
        S("Cross-checking facts", "🔍", "Fact-checker", 4, ["Every number verified twice", "3 conflicts resolved", "Confidence 97%"], { logs: ["verification ✓"] }),
        S("Writing the report", "✍️", "Analyst", 5, [`Report: ${T}`, "Executive summary + 8 sections", "12 charts generated"], { logs: ["charts rendered"] }),
        S("Designing the PDF", "📄", "Layout agent", 3, ["24 pages, branded", "Clickable citations", "Saved to your drive"], { logs: ["pdf 3.1 MB"] }),
      ];
      result = { icon: "📊", title: "Report delivered", sub: `${T} · 24 pages · 52 sources`, link: `karya.ai/r/${randId(r, 8)}.pdf`, kind: "link" };
      break;
    }
    case "booking": {
      const ref = "KRY-" + randId(r, 6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
      steps = [understand,
        S("Searching options", "🔎", "Shopping agent", 5, ["Checked 9 platforms", `${80 + Math.floor(r() * 120)} options found`, "Filtered by your preferences"], { logs: ["parallel search ×9"] }),
        S("Comparing prices", "⚖️", "Deal agent", 4, ["Price history checked", "Reviews analysed (4,812)", "Best value picked"], { art: "options", logs: ["ranking ✓"] }),
        S("Applying offers", "🏷️", "Deal agent", 3, ["Coupon applied: −12%", "Bank offer: −₹250", "Total saved: ₹1,140"], { logs: ["coupon KARYA12 ✓"] }),
        S("Confirming", "🧾", "Checkout agent", 4, ["Details auto-filled", "Payment secured", `Confirmation ${ref}`], { art: "upload", logs: ["3-D secure ✓", "confirmation received"] }),
      ];
      result = { icon: "✅", title: "All booked", sub: `${T} · saved ₹1,140`, link: `Ref ${ref}`, kind: "link" };
      break;
    }
    default: {
      const words = task.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
      const kw = words.slice(0, 4); while (kw.length < 3) kw.push(["details", "deliverable", "follow-up"][kw.length]);
      steps = [understand,
        S("Breaking it into subtasks", "🧩", "Planner · Ultra", 3, kw.slice(0, 3).map((w, i) => `Subtask ${i + 1}: handle “${w}”`), { logs: ["dependency graph: 3 nodes"] }),
        S("Gathering resources", "🌍", "Research agent", 4, [`Collected references for ${T}`, "Pulled data from 7 connected tools", "Context window: 128k"], { logs: ["tools: web, drive, calendar, sheets"] }),
        S("Executing", "⚙️", "Worker agents ×3", 7, [`Working on “${kw[0]}”`, `Working on “${kw[1]}”`, `Working on “${kw[2]}”`], { art: "code", logs: ["agent-1 ✓", "agent-2 ✓", "agent-3 ✓"] }),
        S("Quality check", "🔍", "Critic agent", 3, ["Checked against your request", "Score 9.6 / 10", "Polished final output"], { logs: ["self-review ✓"] }),
        S("Delivering", "📬", "Delivery agent", 3, ["Saved to your workspace", "Summary prepared", "Notifications sent"], { art: "upload", logs: ["delivered ✓"] }),
      ];
      result = { icon: "✨", title: "Task completed", sub: `${T} · ${steps.length} steps · 3 agents`, link: `karya.ai/t/${randId(r, 8)}`, kind: "link" };
    }
  }
  return { task, type: ty, topic: T, slug, steps, result, seed: seedKey };
}

/* ---------- agent tools ---------- */
const TOOLMAP = [
  [/understanding/i, [["🧠", "Task Parser"], ["🗂️", "Workspace Memory"]]],
  [/upload/i, [["▶️", "YouTube API"]]],
  [/prompt/i, [["🪄", "Prompt Optimizer"]]],
  [/scenes/i, [["🎞️", "Motion Model"], ["🖼️", "Upscaler"]]],
  [/voice/i, [["🎙️", "Neural TTS"], ["🎵", "Music Library"]]],
  [/preview/i, [["✂️", "Auto Editor"]]],
  [/render/i, [["🖥️", "GPU Render Farm"]]],
  [/seo|thumbnail/i, [["🏷️", "SEO Optimizer"]]],
  [/deploy/i, [["🚀", "Edge Deploy"], ["🔒", "SSL Manager"]]],
  [/variants|creative|design system/i, [["🎨", "Image Model"]]],
  [/build|code|wireframe|architecture|sitemap|spec/i, [["⌨️", "Code Agent"]]],
  [/test|check|grammar|quality|cross/i, [["🧪", "QA Critic"]]],
  [/schedul/i, [["🗓️", "Scheduler"]]],
  [/publish/i, [["📣", "Social APIs"]]],
  [/sending|gathering context/i, [["✉️", "Mail API"]]],
  [/compar|offers|options|searching options/i, [["⚖️", "Price Compare"]]],
  [/confirm/i, [["🧾", "Checkout Agent"]]],
  [/export|upscal|pdf/i, [["📦", "Exporter"]]],
  [/research|outlin|search|sources|moodboard|audience|requirements|brief|gathering|reading/i, [["🔎", "Web Search"], ["📈", "Trend Scanner"]]],
  [/script|copy|writing|draft|hooks|caption|report/i, [["✍️", "Writer LLM"]]],
  [/executing|subtasks|breaking/i, [["⚙️", "Agent Pool"]]],
  [/deliver/i, [["📬", "Delivery"]]],
];
function toolsFor(step) { for (const [re, t] of TOOLMAP) if (re.test(step.name)) return t; return [["⚙️", "Agent Pool"]]; }
function renderTools(plan) {
  const seen = new Map();
  plan.steps.forEach((s) => toolsFor(s).forEach(([i, n]) => { if (!seen.has(n)) seen.set(n, i); }));
  $("#toolsGrid").innerHTML = [...seen].map(([n, i]) => `<div class="tool" data-tool="${esc(n)}"><span class="ti" aria-hidden="true">${i}</span><span><b>${esc(n)}</b><small>Standby</small></span></div>`).join("");
  $("#toolsCount").textContent = seen.size + " connected";
}
function setTools(step, state) {
  toolsFor(step).forEach(([, n]) => {
    const el = document.querySelector(`.tool[data-tool="${CSS.escape(n)}"]`); if (!el) return;
    el.classList.toggle("active", state === "running"); if (state === "done") el.classList.add("used");
    $("small", el).textContent = state === "running" ? "Running…" : "✓ Used";
    if (state === "running") { const g = $("#toolsGrid"); const left = el.offsetLeft - g.offsetLeft - 14; if (left < g.scrollLeft || left + el.offsetWidth > g.scrollLeft + g.clientWidth) g.scrollTo({ left: Math.max(0, left), behavior: "smooth" }); }
  });
  const act = $$(".tool.active").length; $("#toolsCount").textContent = act ? act + " active" : $$(".tool").length + " connected";
}

/* ---------- artifacts ---------- */
const Artifacts = {
  prompts(plan, box) {
    const T = plan.topic;
    const ps = plan.type.id === "research"
      ? [`"${T}" statistics India 2026`, `${T} expert analysis site:.gov.in`, `${T} vs alternatives comparison`]
      : plan.type.id === "image"
        ? [`${T}, hero composition, studio lighting, ultra-detailed, 85mm, premium poster`, `${T}, minimal flat vector, bold typography space, vibrant gradient`]
        : [`Wide establishing shot of ${T}, golden hour, cinematic 35mm, slow dolly-in, volumetric light`, `Close-up detail of ${T}, shallow depth of field, dramatic rim light, 24fps`, `Aerial drone shot related to ${T}, sweeping motion, epic scale, teal-orange grade`];
    const el = card(box, "🪄 Generated prompts", ps.map((p) => `<p class="prompt-box"></p>`).join(""));
    const nodes = $$(".prompt-box", el);
    return (f) => nodes.forEach((n, i) => { const share = Math.max(0, Math.min(1, f * ps.length - i)); n.textContent = ps[i].slice(0, Math.ceil(ps[i].length * share)); });
  },
  scenes(plan, box) {
    const n = 6;
    const el = card(box, "🎞️ Scenes", `<div class="scenes">${Array.from({ length: n }, (_, i) => `<div class="scene"><div class="art" style="${art(plan.seed + plan.topic, i)}"></div><span class="pct">0%</span><span class="lbl">S${i + 1}</span></div>`).join("")}</div>`);
    const sc = $$(".scene", el);
    return (f) => sc.forEach((s, i) => { const p = Math.max(0, Math.min(1, f * n - i * 0.8)); $(".pct", s).textContent = Math.round(p * 100) + "%"; s.classList.toggle("ready", p >= 1); });
  },
  gallery(plan, box) {
    const el = card(box, "🎨 Variants", `<div class="gallery">${Array.from({ length: 4 }, (_, i) => `<div class="scene"><div class="art" style="${art(plan.seed + plan.topic, i + 10)}"></div><span class="pct">0%</span><span class="lbl">V${i + 1}</span></div>`).join("")}</div>`);
    const sc = $$(".scene", el);
    return (f) => sc.forEach((s, i) => { const p = Math.max(0, Math.min(1, f * 4 - i * 0.7)); $(".pct", s).textContent = Math.round(p * 100) + "%"; s.classList.toggle("ready", p >= 1); });
  },
  images(plan, box) {
    const el = card(box, "🎨 Design system", `<div class="scenes">${Array.from({ length: 3 }, (_, i) => `<div class="scene ready"><div class="art" style="${art(plan.seed + plan.topic, i + 20)}"></div><span class="lbl">${["Home", "Mobile", "Components"][i]}</span></div>`).join("")}</div>`);
    return () => {};
  },
  preview(plan, box) {
    const el = card(box, "👀 Preview", `<div class="player"><div class="art" style="${art(plan.seed + plan.topic, 3)}"></div><span class="tag">PREVIEW · 720p</span><div class="cap">${esc(plan.topic)}</div><button class="play" aria-label="Play preview"></button><div class="ctrl"><span class="cur">0:00</span><div class="seek"><i></i></div><span>0:59</span></div></div>`);
    const pl = $(".player", el), seek = $(".seek i", el), cur = $(".cur", el);
    let t = 0, timer = null;
    $(".play", el).addEventListener("click", () => {
      pl.classList.add("playing");
      clearInterval(timer);
      timer = setInterval(() => { t = (t + 1) % 60; seek.style.width = (t / 59) * 100 + "%"; cur.textContent = "0:" + String(t).padStart(2, "0"); if (!document.body.contains(pl)) clearInterval(timer); }, 1000);
    });
    return () => {};
  },
  seo(plan, box) {
    const r = rng(hash(plan.seed + "seo"));
    const words = plan.topic.toLowerCase().split(/\s+/).filter(Boolean);
    const tags = [...new Set([...words, plan.topic.toLowerCase(), "india", "2026", "viral", "trending", "shorts", "facts", "explained"])].slice(0, 9);
    card(box, "🏷️ SEO pack", `<div class="yt-card"><div class="yt-thumb" style="${art(plan.seed + plan.topic, 7)}"><em>0:59</em></div><div class="yt-meta"><b>${esc(plan.result.ytTitle || plan.topic)}</b><small>Predicted CTR ${(9 + r() * 4).toFixed(1)}% · ${tags.length} tags</small></div></div><div class="tags">${tags.map((t) => `<span>#${esc(t.replace(/\s+/g, ""))}</span>`).join("")}</div>`);
    return () => {};
  },
  upload(plan, box) {
    const label = { video: "Uploading to YouTube", website: "Deploying", social: "Publishing", code: "Pushing to GitHub", email: "Sending", booking: "Confirming", generic: "Delivering" }[plan.type.id] || "Uploading";
    const total = plan.type.id === "video" ? 86.4 : 12.8;
    const el = card(box, "⬆️ " + label, `<div class="upload"><div class="upload-row"><span class="u-txt">0.0 / ${total} MB</span><span class="u-pct">0%</span></div><div class="progress"><i></i></div></div>`);
    const fill = $(".progress i", el), pct = $(".u-pct", el), txt = $(".u-txt", el);
    return (f) => { const p = Math.round(f * 100); fill.style.width = p + "%"; pct.textContent = p + "%"; txt.textContent = (total * f).toFixed(1) + " / " + total + " MB"; };
  },
  code(plan, box) {
    const acts = plan.type.id === "generic"
      ? ["Task split into sub-tasks", "Agents assigned", "Sub-tasks executed", "Critic review passed", "Results delivered"]
      : ["Project workspace opened", "Pages set up: Home, About, Contact", "Theme applied: premium dark", "Mobile layout checked", "Build passed"];
    const el = card(box, "⚙️ Build actions", `<ol class="mini-list">${acts.map((a) => `<li hidden><b>✓</b> ${esc(a)}</li>`).join("")}</ol>`);
    const li = $$("li", el);
    return (f) => li.forEach((l, i) => { l.hidden = f * li.length < i + 0.5; });
  },
  sources(plan, box) {
    const src = ["pib.gov.in", "data.gov.in", "thehindu.com", "worldbank.org", "nature.com", "statista.com", "rbi.org.in", "indianexpress.com"];
    const el = card(box, "🌍 Sources", `<ol class="mini-list">${src.map((s) => `<li hidden><b>${s}</b> · relevant</li>`).join("")}</ol>`);
    const li = $$("li", el);
    return (f) => li.forEach((l, i) => { l.hidden = f * li.length < i + 0.5; });
  },
  email(plan, box) {
    card(box, "✉️ Draft", `<dl class="kv"><dt>To</dt><dd>128 recipients</dd><dt>Subject</dt><dd>${esc(plan.topic)} — quick update</dd></dl><p class="prompt-box" style="margin-top:10px">Hi {first_name},<br><br>Hope you're doing well! Here's a quick update on ${esc(plan.topic)}…</p>`);
    return () => {};
  },
  post(plan, box) {
    card(box, "📣 Post preview", `<p class="prompt-box">Stop scrolling — ${esc(plan.topic)} explained in 5 slides 👇<br><br>Save this for later & share with a friend who needs it.</p><div class="tags"><span>#${esc(plan.slug.replace(/-/g, ""))}</span><span>#india</span><span>#trending</span><span>#learn</span><span>#reels</span></div>`);
    return () => {};
  },
  options(plan, box) {
    const r = rng(hash(plan.seed + "opt"));
    const base = 1500 + Math.floor(r() * 6000);
    const opts = [["Best value", base], ["Fastest", Math.round(base * 1.18)], ["Premium", Math.round(base * 1.6)]];
    card(box, "⚖️ Top options", `<ol class="mini-list">${opts.map(([n, p], i) => `<li><b>${n}</b> · ₹${p.toLocaleString("en-IN")}${i === 0 ? " · ★ picked" : ""}</li>`).join("")}</ol>`);
    return () => {};
  },
};
function card(box, title, inner) {
  const el = document.createElement("div");
  el.className = "card artifact";
  el.innerHTML = `<h4>${esc(title)}</h4>${inner}`;
  box.appendChild(el);
  return el;
}

/* ---------- run engine ---------- */
let current = null; // {plan, token, stepIndex, done}
let runToken = 0;
const els = {};
function initEls() {
  ["heroSection", "runSection", "timeline", "console", "artifacts", "runTitle", "runType", "runStatus", "progressFill", "progressBar", "progressText", "stepCounter", "etaText", "runTimer", "runActions", "agentCount"].forEach((id) => (els[id] = document.getElementById(id)));
}
function clock() { const d = new Date(); return d.toTimeString().slice(0, 8); }
function log(text, lv = "info") {
  const p = document.createElement("p");
  p.innerHTML = `<span class="t">${clock()}</span><span class="lv-${lv}">${esc(text)}</span>`;
  const c = els.console; const cur = $(".cursor", c); if (cur) cur.remove();
  c.appendChild(p);
  const k = document.createElement("span"); k.className = "cursor"; p.appendChild(k);
  while (c.children.length > 160) c.firstChild.remove();
  c.scrollTop = c.scrollHeight;
}
function renderTimeline(plan) {
  els.timeline.innerHTML = plan.steps.map((s, i) => `
    <li class="step" data-i="${i}">
      <div class="step-ico" aria-hidden="true">${s.icon}</div>
      <div class="step-body">
        <div class="step-row"><span class="step-name">${esc(s.name)}</span><span class="step-state">Queued</span></div>
        <div class="step-agent">${esc(s.agent)}</div>
        <div class="step-tools">${toolsFor(s).map(([i, n]) => `<span>${i} ${esc(n)}</span>`).join("")}</div>
        <ul class="subs"></ul>
        <div class="step-bar"><i></i></div>
      </div>
    </li>`).join("");
}
function setStep(i, state) {
  const li = els.timeline.children[i]; if (!li) return;
  li.classList.remove("running", "done"); if (state !== "queued") li.classList.add(state);
  $(".step-state", li).textContent = state === "running" ? "Running" : state === "done" ? "Done ✓" : "Queued";
  if (state === "done") { $(".step-ico", li).textContent = "✓"; $(".step-bar", li).style.display = "none"; }
}
function addSub(i, text, ok) { const ul = $(".subs", els.timeline.children[i]); const li = document.createElement("li"); if (ok) li.className = "ok"; li.textContent = text; ul.appendChild(li); }
function setProgress(plan, doneDur, totalDur, stepIdx) {
  const pct = Math.min(100, Math.round((doneDur / totalDur) * 100));
  els.progressFill.style.width = pct + "%";
  els.progressBar.setAttribute("aria-valuenow", pct);
  els.progressText.textContent = pct + "%";
  els.stepCounter.textContent = stepIdx < plan.steps.length ? `Step ${stepIdx + 1} of ${plan.steps.length}` : `${plan.steps.length} of ${plan.steps.length} steps`;
  const rem = Math.max(0, (totalDur - doneDur) / speed());
  els.etaText.textContent = pct >= 100 ? "Completed" : `ETA ${Math.ceil(rem)}s`;
}
let timerInt = null;
function startTimer() { const t0 = Date.now(); clearInterval(timerInt); els.runTimer.textContent = "00:00"; timerInt = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); els.runTimer.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 500); }

function showRunView(plan) {
  els.heroSection.hidden = true; els.runSection.hidden = false;
  els.runTitle.textContent = plan.task;
  els.runType.textContent = plan.type.icon + " " + plan.type.label;
  els.console.innerHTML = ""; els.artifacts.innerHTML = ""; els.runActions.hidden = true;
  els.agentCount.textContent = plan.steps.length + " steps";
  renderTimeline(plan); renderTools(plan);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function setStatus(done) {
  els.runStatus.classList.toggle("done", done);
  els.runStatus.innerHTML = done ? "✅ Completed" : '<span class="spinner" aria-hidden="true"></span> Working';
}

async function runTask(task) {
  task = task.trim(); if (!task) { toast("Describe a task first ✍️"); $("#taskInput").focus(); return; }
  const token = ++runToken;
  const id = Date.now().toString(36);
  const plan = buildPlan(task, id);
  current = { plan, token, id, stepIndex: 0, done: false };
  closeSidebar();
  showRunView(plan); setStatus(false); startTimer();
  const total = plan.steps.reduce((a, s) => a + s.dur, 0);
  let doneDur = 0;
  log(`${workerName()} worker online · task ${id.toUpperCase()}`, "sys");
  log(`model: ${modelName()} · priority GPU lane`, "sys");
  log(`plan: ${plan.steps.length} steps · type=${plan.type.id} · est ${Math.round(total / speed())}s`, "sys");
  setProgress(plan, 0, total, 0);
  for (let i = 0; i < plan.steps.length; i++) {
    if (token !== runToken) return;
    current.stepIndex = i;
    const s = plan.steps[i];
    setStep(i, "running"); setTools(s, "running");
    if (window.innerWidth >= 900) els.timeline.children[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
    log(`▶ ${s.name}`, "sys");
    const upd = s.art && Artifacts[s.art] ? Artifacts[s.art](plan, els.artifacts) : null;
    const events = [];
    s.subs.forEach((t, k) => events.push({ at: (k + 0.6) / (s.subs.length + 0.4), kind: "sub", t }));
    (s.logs || []).forEach((t, k) => events.push({ at: (k + 0.3) / ((s.logs || []).length + 0.5), kind: "log", t }));
    events.sort((a, b) => a.at - b.at);
    const ms = (s.dur * 1000) / speed();
    const t0 = performance.now();
    let ev = 0;
    while (true) {
      if (token !== runToken) return;
      const f = Math.min(1, (performance.now() - t0) / ms);
      while (ev < events.length && events[ev].at <= f) {
        const e = events[ev++];
        if (e.kind === "sub") { addSub(i, e.t, true); log(`[${s.agent.split(" ")[0].toLowerCase()}] ${e.t}`, "ok"); }
        else log(`  ${e.t}`, "info");
      }
      if (upd) upd(f);
      $(".step-bar i", els.timeline.children[i]).style.width = f * 100 + "%";
      setProgress(plan, doneDur + s.dur * f, total, i);
      if (f >= 1) break;
      await sleep(Math.max(40, Math.min(160, ms / 40)));
    }
    while (ev < events.length) { const e = events[ev++]; if (e.kind === "sub") addSub(i, e.t, true); else log("  " + e.t); }
    doneDur += s.dur;
    setStep(i, "done"); setTools(s, "done");
    log(`✓ ${s.name} — done`, "ok");
  }
  if (token !== runToken) return;
  finishRun(plan, true);
}
function finishRun(plan, animate) {
  current = current || {}; current.done = true; current.plan = plan; current.stepIndex = plan.steps.length;
  clearInterval(timerInt);
  const total = plan.steps.reduce((a, s) => a + s.dur, 0);
  setProgress(plan, total, total, plan.steps.length);
  setStatus(true);
  renderResult(plan);
  els.runActions.hidden = false;
  if (animate) {
    log(`★ ${plan.result.title} — all steps completed`, "ok");
    confetti();
    addHistory(plan);
  }
}
function renderResult(plan) {
  const R = plan.result;
  const el = document.createElement("div");
  el.className = "card artifact result";
  el.id = "resultCard";
  let extra = "";
  if (R.kind === "yt") extra = `<div class="yt-card"><div class="yt-thumb" style="${art(plan.seed + plan.topic, 7)}"><em>0:59</em></div><div class="yt-meta"><b>${esc(R.ytTitle)}</b><small>Your channel · Public · just now</small></div></div>`;
  el.innerHTML = `<div class="result-head"><div class="result-ico">${R.icon}</div><div><b>${esc(R.title)}</b><small>${esc(R.sub)}</small></div></div>${extra}<div class="result-link"><span>${esc(R.link)}</span><button class="btn btn-ghost btn-sm" data-copy="${esc(R.link)}">Copy</button></div>`;
  els.artifacts.prepend(el);
  if (window.KaryaPremium) KaryaPremium.lock(el, plan); // demo paywall
  $("[data-copy]", el).addEventListener("click", (e) => { const v = e.currentTarget.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast("Copied ✓"), () => toast(v)); });
  setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 200);
}
function replay(entry) {
  ++runToken;
  const plan = buildPlan(entry.task, entry.id);
  current = { plan, token: runToken, id: entry.id, done: true };
  closeSidebar();
  showRunView(plan);
  plan.steps.forEach((s, i) => { s.subs.forEach((t) => addSub(i, t, true)); setStep(i, "done"); setTools(s, "done"); if (s.art && Artifacts[s.art]) Artifacts[s.art](plan, els.artifacts)(1); });
  els.runTimer.textContent = entry.elapsed || "00:00";
  log(`Restored run ${entry.id.toUpperCase()} from history`, "sys");
  plan.steps.forEach((s) => log(`✓ ${s.name}`, "ok"));
  finishRun(plan, false);
  renderHistory();
}
function newTask() {
  ++runToken; current = null; clearInterval(timerInt);
  els.runSection.hidden = true; els.heroSection.hidden = false;
  closeSidebar(); renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => $("#taskInput").focus({ preventScroll: true }), 300);
}

/* ---------- history ---------- */
function addHistory(plan) {
  history.unshift({ id: plan.seed, task: plan.task, type: plan.type.id, icon: plan.type.icon, ts: Date.now(), elapsed: els.runTimer.textContent });
  history = history.slice(0, 30); save(LS.history, history); renderHistory();
}
function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago"; return Math.floor(s / 86400) + " d ago"; }
function renderHistory() {
  const ul = $("#historyList");
  const q = (($("#historySearch") || {}).value || "").trim().toLowerCase();
  const list = q ? history.filter((h) => h.task.toLowerCase().includes(q)) : history;
  ul.innerHTML = list.map((h) => `<li><button data-id="${esc(h.id)}" class="${current && current.id === h.id ? "active" : ""}"><span class="h-ico" aria-hidden="true">${h.icon || "✨"}</span><span class="h-txt"><b>${esc(h.task)}</b><small>✓ Completed · ${ago(h.ts)}</small></span></button></li>`).join("");
  $("#historyEmpty").hidden = list.length > 0;
  $("#historyEmpty").textContent = q && history.length ? "No projects match your search." : "No projects yet. Every task you run is saved here.";
  $$("button", ul).forEach((b) => b.addEventListener("click", () => { const h = history.find((x) => x.id === b.dataset.id); if (h) replay(h); }));
}

/* ---------- UI bits ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400); }
function confetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const w = document.createElement("div"); w.className = "confetti"; w.setAttribute("aria-hidden", "true");
  const cols = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#fbbf24"];
  for (let i = 0; i < 70; i++) { const c = document.createElement("i"); c.style.left = Math.random() * 100 + "%"; c.style.background = cols[i % cols.length]; c.style.animationDelay = Math.random() * 0.6 + "s"; c.style.animationDuration = 2 + Math.random() * 1.6 + "s"; w.appendChild(c); }
  document.body.appendChild(w); setTimeout(() => w.remove(), 4200);
}
const sidebar = () => $("#sidebar");
function openSidebar() { sidebar().classList.add("open"); $("#scrim").hidden = false; }
function closeSidebar() { sidebar().classList.remove("open"); $("#scrim").hidden = true; }

const EXAMPLES = [
  "Make a 60-second video about the Indian Army and upload it to YouTube",
  "Mere channel ke liye ek motivational video bana ke YouTube pe upload kar do",
  "Build a portfolio website for my photography business",
  "Design a poster for our college tech fest",
  "Research the best government jobs after 12th and make a report",
  "Write an Instagram post about morning study habits",
  "Plan a weekend trip to Rishikesh and book a hotel",
];
const CAPS = [
  ["🎬", "Videos", "Script → AI scenes → voice → edit → YouTube upload", EXAMPLES[0]],
  ["🌐", "Websites", "Design, build and deploy live sites", EXAMPLES[2]],
  ["🎨", "Design", "Posters, logos, thumbnails in 4K", EXAMPLES[3]],
  ["📊", "Research", "Deep reports with verified sources", EXAMPLES[4]],
  ["📣", "Social", "Captions, creatives, scheduling", EXAMPLES[5]],
  ["🧩", "Apps & code", "Spec → code → tests → GitHub", "Build a to-do app with reminders and dark mode"],
  ["✉️", "Email", "Drafts, outreach and follow-ups", "Send a newsletter email about our new course launch"],
  ["🛒", "Booking", "Compare, apply offers, confirm", EXAMPLES[6]],
];
const TOOLS = ["YouTube", "GitHub", "Gmail", "Google Drive", "Instagram", "LinkedIn", "X", "Canva", "Notion", "Slack", "Shopify", "WordPress", "Figma", "Stripe", "Calendar", "Sheets", "Zoom", "WhatsApp"];

function fillComposer(text, run) { const ta = $("#taskInput"); ta.value = text; if (run) runTask(text); else { ta.focus({ preventScroll: true }); document.getElementById("workspace").scrollIntoView({ behavior: "smooth", block: "center" }); } }

/* ---------- chat ---------- */
let chatLog = []; // {role, content}
let chatBusy = false;
const TASKY = /\b(make|create|build|generate|design|write|upload|post|send|book|order|research|edit|render|plan|bana|banao|bnao|bana do|kar do|kr do|likh|likho|bhej|bhejo)\b/i;
function cannedReply(text) {
  const t = text.toLowerCase();
  const hi = HINGLISH.test(t);
  const n = workerName();
  if (current && !current.done && /\b(status|progress|kitna|kaha|update|how long|done yet|ho gaya)\b/.test(t)) {
    const s = current.plan.steps[current.stepIndex];
    return hi ? `Abhi **${s.name}** chal raha hai (step ${current.stepIndex + 1}/${current.plan.steps.length}). ${els.etaText.textContent} — main bata dunga jaise hi done hota hai ⚡` : `Currently on **${s.name}** (step ${current.stepIndex + 1} of ${current.plan.steps.length}). ${els.etaText.textContent} — I'll ping you the moment it's done ⚡`;
  }
  if (/^(hi|hello|hey|hii+|namaste|yo|hlo|hola)\b/.test(t)) return hi || /namaste/.test(t) ? `Namaste! 👋 Main ${n} hoon — tumhara premium AI worker. Koi bhi task likho, main plan karke poora kar dunga.` : `Hey! 👋 I'm ${n}, your premium AI worker. Tell me any task and I'll plan it and get it done end-to-end.`;
  if (/(who are you|kaun ho|what are you|tum kya ho|about you)/.test(t)) return hi ? `Main ${n} hoon — ek autonomous AI worker. Video, website, design, research, posts, code — sab khud karta hoon, 42 tools ke saath. 🚀` : `I'm ${n} — an autonomous AI worker. Videos, websites, designs, research, posts and code, all handled end-to-end across 42 connected tools. 🚀`;
  if (/(what can you do|kya kar sakte|kya kr skte|features|capabilit|help)/.test(t)) return hi ? "Main ye sab kar sakta hoon:\n• 🎬 Video bana ke YouTube pe upload\n• 🌐 Website bana ke live\n• 🎨 Poster / logo / thumbnail\n• 📊 Research report\n• 📣 Insta / LinkedIn posts\nBas task likho! ✨" : "Here's what I can take off your plate:\n• 🎬 Make a video and publish it to YouTube\n• 🌐 Build and deploy a website\n• 🎨 Posters, logos, thumbnails\n• 📊 Deep research reports\n• 📣 Social posts, scheduled\nJust describe the task ✨";
  if (/(price|pricing|plan|cost|paisa|kitne ka|subscription|pro)\b/.test(t)) return hi ? "Tum **Pro** plan pe ho ✨ — unlimited tasks, priority GPU lane aur 4K renders. Plans neeche Pricing section me hain." : "You're on **Pro** ✨ — unlimited tasks, priority GPU lane and 4K renders. Plans are in the Pricing section below.";
  if (/(api key|key)\b/.test(t)) return hi ? "Koi key nahi chahiye 🙂 Karya AI seedha chat karta hai — chat ke liye upar Chat kholo." : "No key needed 🙂 Karya AI chats directly — open Chat from the top.";
  if (/(thank|thanks|shukriya|dhanyavad|thx|great|awesome|nice|mast|badhiya)/.test(t)) return hi ? "Koi baat nahi! 🙌 Aur kuch karna ho to batao." : "Anytime! 🙌 What should we tackle next?";
  if (TASKY.test(t) || t.split(/\s+/).length >= 5) {
    const plan = buildPlan(text, "chat");
    const steps = plan.steps.slice(1, 5).map((s) => s.name.toLowerCase()).join(" → ");
    return { text: hi ? `Samajh gaya ✅ — ye ek **${plan.type.label}** task hai. Plan: ${steps}. Start karun?` : `Got it ✅ — that's a **${plan.type.label}** task. My plan: ${steps}. Shall I start?`, task: text };
  }
  return hi ? "Hmm, thoda aur detail do 🙂 — kya banana hai, kis topic pe, aur kahan publish karna hai?" : "Tell me a bit more 🙂 — what should I make, on what topic, and where should it go?";
}
function md(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
function addMsg(role, text, task) {
  const body = $("#chatBody");
  const d = document.createElement("div");
  d.className = "msg " + (role === "user" ? "user" : "bot");
  d.innerHTML = role === "user" ? `<p>${esc(text)}</p>` : md(text);
  if (task) addRunBtn(d, task);
  body.appendChild(d); body.scrollTop = body.scrollHeight;
  return d;
}
function addRunBtn(d, task) {
  const b = document.createElement("button");
  b.className = "btn btn-primary btn-sm run-inline"; b.textContent = "▶ Run this task";
  b.addEventListener("click", () => { closeChat(); runTask(task); });
  d.appendChild(b);
}
function typingBubble() { const d = document.createElement("div"); d.className = "msg bot"; d.innerHTML = '<span class="typing" aria-label="Typing"><i></i><i></i><i></i></span>'; $("#chatBody").appendChild(d); $("#chatBody").scrollTop = 1e9; return d; }
function systemPrompt() {
  const n = workerName();
  let ctx = "";
  if (current && current.plan) {
    const p = current.plan;
    ctx = current.done ? `\nThe user's latest task "${p.task}" is COMPLETED: ${p.result.title} (${p.result.sub}).` : `\nThe user's current task "${p.task}" is RUNNING, now on step ${current.stepIndex + 1}/${p.steps.length}: ${p.steps[current.stepIndex].name}.`;
  }
  return `You are ${n}, the premium autonomous AI worker inside "Karya AI", a paid Pro workspace. You plan and execute any task end-to-end through connected tools (YouTube, GitHub, Gmail, Drive, Instagram, Canva, Notion and more): videos (script, AI scenes, voiceover, render, YouTube upload), websites, designs, research reports, social posts, code, emails, bookings.
Style: confident, warm, premium, concise (2-5 short sentences or a short bullet list). Reply in the user's language and style: if they write Hinglish (Hindi in Latin letters), reply in friendly Hinglish; otherwise English. Use an emoji occasionally.
When the user asks for a task, confirm it, show a crisp 3-5 step plan, and tell them to tap "Run this task" (or type it in the workspace) to start. Never mention being a language model or any AI company, model or provider; you are ${n}, Karya AI's own model built by the Karya AI team.${ctx}`;
}
async function groqChat(onDelta) {
  const msgs = [{ role: "system", content: systemPrompt() }, ...chatLog.slice(-14)];
  const base = { model: settings.model || DEFAULTS.model, messages: msgs, temperature: 0.7, max_completion_tokens: 700, stream: true };
  const tries = /gpt-oss/.test(base.model) ? [Object.assign({}, base, { reasoning_effort: "low", include_reasoning: false }), base] : [base];
  let res, lastErr;
  for (const body of tries) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.key }, body: JSON.stringify(body) });
    if (res.ok) break;
    lastErr = res.status;
    if (res.status !== 400) break;
  }
  if (!res.ok) { let msg = ""; try { msg = (await res.json()).error.message; } catch (e) {} const err = new Error(msg || "HTTP " + res.status); err.status = res.status || lastErr; throw err; }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", out = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const ln of lines) {
      const l = ln.trim(); if (!l.startsWith("data:")) continue;
      const data = l.slice(5).trim(); if (data === "[DONE]") continue;
      try { const j = JSON.parse(data); const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (d) { out += d; onDelta(out); } } catch (e) {}
    }
  }
  return out;
}
async function sendChat(text) {
  text = text.trim(); if (!text || chatBusy) return;
  chatBusy = true;
  addMsg("user", text); chatLog.push({ role: "user", content: text });
  $("#chatInput").value = "";
  const tb = typingBubble();
  try {
    if (settings.key) {
      let firstChunk = true;
      const final = await groqChat((out) => { if (firstChunk) { tb.innerHTML = ""; firstChunk = false; } tb.innerHTML = md(out); $("#chatBody").scrollTop = 1e9; });
      const reply = final || "…";
      if (firstChunk) tb.innerHTML = md(reply);
      chatLog.push({ role: "assistant", content: reply });
      if (TASKY.test(text)) addRunBtn(tb, text);
    } else {
      await sleep(650 + Math.random() * 700);
      const r = cannedReply(text);
      const reply = typeof r === "string" ? r : r.text;
      tb.innerHTML = md(reply);
      if (r.task) addRunBtn(tb, r.task);
      chatLog.push({ role: "assistant", content: reply });
    }
  } catch (e) {
    const bad = e.status === 401 || e.status === 403;
    if (bad) { settings.key = ""; save(LS.settings, settings); updateChatMode(); }
    tb.innerHTML = md(`⚠️ Live AI is unreachable right now. Answering in quick mode:`);
    { const r = cannedReply(text); const reply = typeof r === "string" ? r : r.text; const d = addMsg("bot", reply, r.task); chatLog.push({ role: "assistant", content: reply }); }
  }
  chatBusy = false;
  $("#chatBody").scrollTop = 1e9;
}
function updateChatMode() { $("#chatMode").innerHTML = settings.key ? '<span class="dot dot-live"></span> Online · Live AI' : '<span class="dot dot-live"></span> Online'; }
function openChat(prefill) {
  location.href = "chat.html" + (prefill ? "?q=" + encodeURIComponent(prefill) : ""); return;
  $("#chat").hidden = false; $("#chatFab").hidden = true;
  if (!$("#chatBody").children.length) {
    addMsg("bot", `Hi! I'm **${workerName()}**, your Pro worker ⚡\nAsk me anything, or tell me a task and I'll get it done.`);
  }
  renderSuggest();
  if (prefill) { $("#chatInput").value = prefill; }
  setTimeout(() => $("#chatInput").focus(), 50);
}
function closeChat() { $("#chat").hidden = true; $("#chatFab").hidden = false; }
function renderSuggest() {
  const sug = current && !current.done ? ["What's the status?", "How long left?", "What can you do?"] : current && current.done ? ["What did you deliver?", "Make a shorts version too", "What can you do?"] : ["What can you do?", "Kya tum video bana sakte ho?", "Make a logo for my startup"];
  $("#chatSuggest").innerHTML = sug.map((s) => `<button type="button">${esc(s)}</button>`).join("");
  $$("#chatSuggest button").forEach((b) => b.addEventListener("click", () => sendChat(b.textContent)));
}

/* ---------- settings ---------- */
function openSettings() {
  $("#workerName").value = settings.name; $("#groqModel").value = settings.model; $("#speedSel").value = settings.speed;
  if (!$("#groqModel").value) $("#groqModel").value = DEFAULTS.model;
  $("#settingsModal").hidden = false; setTimeout(() => $("#workerName").focus(), 50);
}
function closeSettings() { $("#settingsModal").hidden = true; }
/* ---------- wire up ---------- */
function init() {
  initEls();
  $("#chips").innerHTML = EXAMPLES.map((e) => `<button type="button" class="chip">${esc(e)}</button>`).join("");
  $$("#chips .chip").forEach((c) => c.addEventListener("click", () => { $("#taskInput").value = c.textContent; $("#taskInput").focus({ preventScroll: true }); }));
  $("#capGrid").innerHTML = CAPS.map(([e, t, d]) => `<button type="button" class="cap"><span class="e" aria-hidden="true">${e}</span><b>${t}</b><small>${d}</small></button>`).join("");
  $$("#capGrid .cap").forEach((c, i) => c.addEventListener("click", () => { newTask(); fillComposer(CAPS[i][3]); }));
  $("#marquee").innerHTML = [...TOOLS, ...TOOLS].map((t) => `<span>${t}</span>`).join("");
  $("#composer").addEventListener("submit", (e) => { e.preventDefault(); runTask($("#taskInput").value); });
  $("#taskInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); runTask($("#taskInput").value); } });
  const ms = $("#modelSel"); ms.value = settings.workerModel || "ultra";
  ms.addEventListener("change", () => { settings.workerModel = ms.value; save(LS.settings, settings); toast(`Model: ${ms.options[ms.selectedIndex].text} ⚡`); });
  $("#themeToggle").addEventListener("click", () => { settings.theme = settings.theme === "light" ? "dark" : "light"; save(LS.settings, settings); applyTheme(); });
  $("#historySearch").addEventListener("input", renderHistory);
  $("#newTaskBtn").addEventListener("click", newTask);
  $$('a[href="#workspace"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
  $("#runAnother").addEventListener("click", newTask);
  $("#askWorker").addEventListener("click", () => openChat());
  $("#historyToggle").addEventListener("click", openSidebar);
  $("#historyClose").addEventListener("click", closeSidebar);
  $("#scrim").addEventListener("click", closeSidebar);
  $("#chatFab").addEventListener("click", () => openChat());
  $("#openChatTop").addEventListener("click", () => openChat());
  $("#chatClose").addEventListener("click", closeChat);
  $("#chatClear").addEventListener("click", () => { chatLog = []; $("#chatBody").innerHTML = ""; openChat(); });
  $("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); sendChat($("#chatInput").value); });
  $("#openSettings").addEventListener("click", openSettings);
  $("#settingsClose").addEventListener("click", closeSettings);
  $("#settingsModal").addEventListener("click", (e) => { if (e.target.id === "settingsModal") closeSettings(); });
  $("#saveSettings").addEventListener("click", () => {
    settings = { theme: settings.theme, workerModel: settings.workerModel, name: $("#workerName").value.trim() || "Karya", key: settings.key || "", model: $("#groqModel").value, speed: $("#speedSel").value };
    save(LS.settings, settings); updateChatMode(); closeSettings(); toast("Saved ✓");
  });
  $("#clearHistory").addEventListener("click", () => { history = []; save(LS.history, history); renderHistory(); toast("History cleared"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSettings(); closeChat(); closeSidebar(); } });
  $$(".billing-toggle button").forEach((b) => b.addEventListener("click", () => {
    $$(".billing-toggle button").forEach((x) => x.classList.toggle("active", x === b));
    $$(".price b").forEach((p) => (p.textContent = p.dataset[b.dataset.bill]));
  }));
  $$(".plan-btn").forEach((b) => b.addEventListener("click", () => toast(b.dataset.plan === "Pro" ? "You're already on Pro ✨" : b.dataset.plan === "Agency" ? "Our team will reach out shortly 🤝" : "You're on Pro — no changes made")));
  renderHistory(); updateChatMode();
  const pid = new URLSearchParams(location.search).get("project"); // opened from the chat
  if (pid) { const h = history.find((x) => x.id === pid); if (h) setTimeout(() => replay(h), 60); }
}
document.addEventListener("DOMContentLoaded", init);
window.Karya = { runTask, buildPlan, detectType, extractTopic };
})();
