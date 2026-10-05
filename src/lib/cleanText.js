// Free-text a person types that later gets shown on pages (their name, their agency name).
// Strips angle brackets and control characters so markup can't be smuggled in, collapses
// whitespace, and caps the length. The pages also escape on output — this is the second layer.
function cleanText(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = { cleanText };
