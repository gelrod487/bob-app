// Express 4 doesn't catch rejected promises from async route handlers — an unhandled
// rejection there crashes the whole Node process (this is exactly what took the app down
// in production: one bad Stripe API call killed every other request too). Wrap every async
// handler with this so failures become a normal 500 response instead.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
