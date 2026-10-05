// Standard browser protections, sent on every response. Deliberately no script-src rule in the
// CSP: the pages use inline scripts and a few CDNs, so a strict one would break them — this
// covers the parts that are safe to lock down (no embedding in other sites, no plugins, no
// rewriting of <base>, forms only post back to BOB).
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  // Only over HTTPS (Render terminates TLS and tells us via x-forwarded-proto) so local http dev is unaffected.
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = { securityHeaders };
