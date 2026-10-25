// Karya AI — proxy health: says whether the server key is configured (never the key itself).
"use strict";
module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: true, key: !!process.env.GROQ_API_KEY }));
};
