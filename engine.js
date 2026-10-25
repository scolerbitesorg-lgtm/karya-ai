/* Karya AI — task engine shared with the chat (generated from script.js: task understanding + plan templates + tools). */
(() => {
"use strict";
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
window.KaryaEngine = { HINGLISH, TYPES, detectType, extractTopic, buildPlan, toolsFor, art, hash, rng };
})();
