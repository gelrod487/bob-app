// An error carrying an HTTP status whose message is safe to show the caller — the global
// error handler in server.js passes these through instead of the generic 500.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

module.exports = { httpError };
