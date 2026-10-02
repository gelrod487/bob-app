// Validation and import planning for IMO commission rate rows, shared by the admin rate
// editor and CSV import. Mirrors what the producer-side routes (commissionSchedule.js,
// annuityCommissionSchedule.js) accept, with range checks added since a bulk import can
// carry a mis-keyed column.
const ANNUITY_TIERS = ['green', 'yellow', 'blue', 'silver', 'gold', 'platinum', 'black', 'royal', 'red'];
const MAX_IMPORT_ROWS = 5000;

const clean = (v) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim());

// Returns { ok: true, row } with normalized values, or { ok: false, error }.
function validateRateRow(type, input) {
  const carrierName = clean(input.carrierName);
  const productName = clean(input.productName);
  if (!carrierName || !productName) return { ok: false, error: 'carrierName and productName are required.' };
  if (carrierName.length > 120 || productName.length > 120) return { ok: false, error: 'carrierName/productName are too long.' };

  const rawRate = clean(input.payoutRate).toString().replace(/%$/, '');
  const payoutRate = Number(rawRate);
  if (rawRate === '' || !Number.isFinite(payoutRate)) return { ok: false, error: `payoutRate "${clean(input.payoutRate)}" isn't a number.` };

  if (type === 'annuity') {
    const tier = clean(input.tier).toLowerCase();
    if (!ANNUITY_TIERS.includes(tier)) return { ok: false, error: `tier must be one of: ${ANNUITY_TIERS.join(', ')}` };
    if (payoutRate < 0 || payoutRate > 100) return { ok: false, error: 'An annuity payoutRate must be between 0 and 100.' };
    return { ok: true, row: { carrierName, productName, tier, payoutRate: Math.round(payoutRate * 1000) / 1000 } };
  }

  const level = Number(clean(input.contractLevel));
  if (!Number.isInteger(level) || level < 1 || level > 300) return { ok: false, error: `contractLevel "${clean(input.contractLevel)}" must be a whole number from 1 to 300.` };
  if (payoutRate < 0 || payoutRate > 400) return { ok: false, error: 'A life payoutRate must be between 0 and 400.' };
  return { ok: true, row: { carrierName, productName, contractLevel: level, payoutRate: Math.round(payoutRate * 1000) / 1000 } };
}

const keyOf = (type, r) => (type === 'annuity'
  ? `${r.carrierName}\u0000${r.productName}\u0000${r.tier}`
  : `${r.carrierName}\u0000${r.productName}\u0000${r.contractLevel}`);

// Works out what an import WOULD do, without touching the database. `existing` is the IMO's
// current rows. Duplicate keys inside the file are errors (which row wins would be a guess).
// `line` numbers assume a header row, so they match what a spreadsheet shows.
function planImport(type, rawRows, existing) {
  const have = new Map(existing.map((e) => [keyOf(type, e), e]));
  const seen = new Map();
  const plan = { creates: [], updates: [], unchanged: 0, errors: [] };

  rawRows.forEach((raw, i) => {
    const line = i + 2;
    const v = validateRateRow(type, raw);
    if (!v.ok) { plan.errors.push({ line, error: v.error }); return; }
    const key = keyOf(type, v.row);
    if (seen.has(key)) { plan.errors.push({ line, error: `Duplicate of line ${seen.get(key)} (same carrier, product, and ${type === 'annuity' ? 'tier' : 'contract level'}).` }); return; }
    seen.set(key, line);
    const current = have.get(key);
    if (!current) plan.creates.push(v.row);
    else if (Math.abs(Number(current.payoutRate) - v.row.payoutRate) < 1e-9) plan.unchanged++;
    else plan.updates.push({ id: current.id, row: v.row, oldRate: Number(current.payoutRate) });
  });
  return plan;
}

module.exports = { ANNUITY_TIERS, MAX_IMPORT_ROWS, validateRateRow, planImport, keyOf };
