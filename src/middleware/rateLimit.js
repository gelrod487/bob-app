// Small in-memory fixed-window rate limiter. BOB runs as a single Render instance, so memory is
// enough; if it ever scales to several instances each would count separately (limits become
// looser, never wrongly stricter) and this should move to a shared store.
function clientIp(req) {
  // Behind Render (and Cloudflare, if proxied) the real address is the first x-forwarded-for entry.
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf);
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map(); // key -> { count, resetAt }
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs);
  timer.unref();

  return function limiter(req, res, next) {
    const key = (keyFn || clientIp)(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message || 'Too many requests. Please slow down and try again in a moment.' });
    }
    next();
  };
}

module.exports = { rateLimit, clientIp };
