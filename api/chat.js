// Karya AI — Groq chat proxy (Vercel Node serverless function, no dependencies).
// The key lives ONLY in the Vercel environment variable GROQ_API_KEY; it is never sent to the browser.
"use strict";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]; // the models the site offers
const DEFAULT_MODEL = MODELS[0];
const FALLBACK = { "openai/gpt-oss-20b": "openai/gpt-oss-120b", "openai/gpt-oss-120b": "openai/gpt-oss-20b" }; // used once when a model's quota is spent
const scrub = (s) => String(s || "").replace(/https?:\/\/\S+/g, "").replace(/\b(org|organization)[_ ]\w+/gi, "").replace(/\b(groq|openai|meta|llama|qwen|gpt-oss)[\w.\/-]*/gi, "the AI service").trim();
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 16000;
const MAX_TOTAL_CHARS = 48000;
const MAX_BODY_BYTES = 200 * 1024;
const RATE = { perMinute: 20, perDay: 400 }; // per IP, per warm instance (best effort)

const hits = new Map(); // ip -> { m: [timestamps in last minute], d: count, day }
function limited(ip) {
  const now = Date.now(), day = Math.floor(now / 864e5);
  let h = hits.get(ip);
  if (!h || h.day !== day) { h = { m: [], d: 0, day }; hits.set(ip, h); }
  h.m = h.m.filter((t) => now - t < 60000);
  if (h.m.length >= RATE.perMinute) return Math.ceil((60000 - (now - h.m[0])) / 1000) || 1;
  if (h.d >= RATE.perDay) return 3600;
  h.m.push(now); h.d++;
  if (hits.size > 5000) { for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; } }
  return 0;
}

function send(res, status, obj, extra) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (extra) for (const k of Object.keys(extra)) res.setHeader(k, extra[k]);
  res.end(JSON.stringify(obj));
}
const fail = (res, status, message, extra) => send(res, status, { error: { message, type: "proxy_error" } }, extra);

async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body));
  }
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY_BYTES) throw new Error("too_large"); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function clean(input) {
  if (!input || typeof input !== "object") return { err: "Body must be a JSON object." };
  const raw = input.messages;
  if (!Array.isArray(raw) || !raw.length) return { err: "messages must be a non-empty array." };
  // keep the system prompt (first, if any) + the most recent turns
  let msgs = raw.filter((m) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) }));
  if (!msgs.length) return { err: "No valid messages." };
  const sys = msgs[0].role === "system" ? [msgs.shift()] : [];
  msgs = msgs.filter((m) => m.role !== "system").slice(-MAX_MESSAGES);
  let total = sys.reduce((n, m) => n + m.content.length, 0);
  const kept = [];
  for (let i = msgs.length - 1; i >= 0; i--) { total += msgs[i].content.length; if (total > MAX_TOTAL_CHARS && kept.length) break; kept.unshift(msgs[i]); }
  const body = {
    model: MODELS.includes(input.model) ? input.model : DEFAULT_MODEL,
    messages: sys.concat(kept),
    stream: input.stream !== false,
    max_completion_tokens: Math.max(1, Math.min(MAX_TOKENS, parseInt(input.max_completion_tokens || input.max_tokens, 10) || MAX_TOKENS)),
  };
  const t = Number(input.temperature);
  if (Number.isFinite(t)) body.temperature = Math.max(0, Math.min(2, t));
  const tp = Number(input.top_p);
  if (Number.isFinite(tp)) body.top_p = Math.max(0, Math.min(1, tp));
  if (["none", "low", "medium", "high", "default"].includes(input.reasoning_effort)) body.reasoning_effort = input.reasoning_effort;
  if (typeof input.include_reasoning === "boolean") body.include_reasoning = input.include_reasoning;
  return { body };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Only POST is allowed.", { Allow: "POST" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return send(res, 500, { error: "GROQ_API_KEY not set" });

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "?").split(",")[0].trim();
  const wait = limited(ip);
  if (wait) return fail(res, 429, "Too many messages from this device. Please wait a moment and try again.", { "Retry-After": String(wait) });

  let input;
  try { input = await readBody(req); }
  catch (e) { return e.message === "too_large" ? fail(res, 413, "Request too large.") : fail(res, 400, "Body must be valid JSON."); }
  const { body, err } = clean(input);
  if (err) return fail(res, 400, err);

  const call = (b) => fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(b) });
  let up;
  try {
    up = await call(body);
    // A model's own quota ran out (per-minute / per-day): try the other model once before telling the user.
    if (up.status === 429) {
      const alt = FALLBACK[body.model];
      if (alt) { await up.text().catch(() => {}); const r2 = await call(Object.assign({}, body, { model: alt })); up = r2; }
    }
  } catch (e) { return fail(res, 502, "Could not reach the AI service."); }

  if (!up.ok) { // errors: status kept, provider words never reach the browser (vendor/org names scrubbed)
    let msg = ""; try { const j = JSON.parse(await up.text()); msg = (j.error && j.error.message) || ""; } catch (e) {}
    const ra = up.headers.get("retry-after");
    const neutral = { 401: "Service unavailable.", 403: "Request refused.", 404: "Model unavailable.", 413: "Request too large.", 429: "Rate limit reached. Please try again later." };
    const words = up.status === 400 ? scrub(msg).slice(0, 300) || "Bad request." : neutral[up.status] || "The AI service had a problem.";
    return fail(res, up.status, words, ra ? { "Retry-After": ra } : null);
  }
  if (!body.stream || !up.body) { const text = await up.text(); res.statusCode = up.status; res.setHeader("Content-Type", up.headers.get("content-type") || "application/json"); res.setHeader("Cache-Control", "no-store"); return res.end(text); }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();
  let closed = false;
  req.on("close", () => { closed = true; });
  try {
    for await (const chunk of up.body) { if (closed) break; res.write(Buffer.from(chunk)); }
  } catch (e) {
    if (!closed) res.write('data: {"error":{"message":"Stream interrupted"}}\n\n');
  }
  res.end();
};
