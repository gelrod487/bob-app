// First-touch "where did this person come from" tracking. On the first visit that carries a marketing link
// (?utm_source=...&utm_medium=...&utm_campaign=..., or ?ref=...) or comes from another site, remember it in
// this browser; sign-up then sends it along so the admin console can show which posts and messages bring
// customers. Nothing personal is stored, and a visit with no source (typed the address in) records nothing.
(function () {
  var KEY = 'bob_source', MAX_AGE = 90 * 24 * 60 * 60 * 1000;
  function clean(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9._ -]/g, '').trim().slice(0, 60); }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  window.getBobSource = function () { var s = read(); return s && Date.now() - s.at < MAX_AGE ? { source: s.source, medium: s.medium, campaign: s.campaign } : null; };
  try {
    if (window.getBobSource()) return; // first touch wins
    var q = new URLSearchParams(location.search);
    var source = clean(q.get('utm_source') || q.get('ref') || q.get('source'));
    var medium = clean(q.get('utm_medium')), campaign = clean(q.get('utm_campaign'));
    if (!source && document.referrer) {
      var host = '';
      try { host = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
      if (host && host !== location.hostname.replace(/^www\./, '')) {
        source = /instagram/.test(host) ? 'instagram' : /facebook|(^|\.)fb\.com$/.test(host) ? 'facebook' : /linkedin|lnkd\.in/.test(host) ? 'linkedin'
          : /(^|\.)google\./.test(host) ? 'google' : /(^|\.)t\.co$|twitter|(^|\.)x\.com$/.test(host) ? 'x' : clean(host);
        if (!medium) medium = 'referral';
      }
    }
    if (source) localStorage.setItem(KEY, JSON.stringify({ source: source, medium: medium, campaign: campaign, at: Date.now() }));
  } catch (e) { /* storage blocked: tracking just stays off */ }
})();
