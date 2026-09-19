const Stripe = require('stripe');

// .trim() guards against a stray trailing newline/whitespace character sneaking into the
// env var via a hosting platform's dashboard paste — that's invisible in the UI but crashes
// every request as soon as Stripe's client tries to use it in an HTTP header.
module.exports = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim());
