const express = require('express');
const XLSX = require('xlsx');
const prisma = require('../lib/db');
const { buildReminderDates } = require('./policies');

const router = express.Router();

// ---- Synonym table from bob-schema.md "CSV import — column mapping logic" ----
const FIELD_SYNONYMS = {
  clientName: ['client', 'client name', 'customer', 'insured', 'policyholder', 'name', 'full name'],
  phone: ['phone', 'phone number', 'cell', 'mobile'],
  email: ['email', 'email address'],
  carrier: ['carrier', 'company', 'insurer', 'ins co'],
  policyNumber: ['app #', 'policy #', 'app #/ policy #', 'app #/policy #', 'policy number', 'app number'],
  productType: ['product', 'product type', 'plan', 'plan type', 'policy type'],
  faceAmount: ['face amount', 'face', 'coverage', 'coverage amount', 'death benefit'],
  monthlyPremium: ['monthly premium', 'premium/mo', 'premium (monthly)', 'monthly prem'],
  annualPremium: ['annual premium', 'annual prem', 'yearly premium', 'ap', 'total ap'],
  issueDate: ['issue date', 'issued', 'effective date', 'policy date', 'start date', 'approved date', 'submit date'],
  status: ['status', 'policy status'],
  leadType: ['lead type', 'lead source'],
  leadVendor: ['lead vendor'],
  advanceCommission: ['commission', 'advance', 'comp', 'commission paid', 'initial commission', 'advance commission'],
  additionalCommission: ['final commission', 'additional commission', 'renewal'],
  chargeback: ['chargeback', 'charge back', 'charge back amount'],
};

// bob-schema.md finding #3: disposition text sometimes lands in a numeric column
// (an application that never issued has nowhere else to note why). Recognize it
// instead of failing the row.
const STATUS_KEYWORDS = {
  active: ['approved', 'paid', 'issued'],
  declined: ['declined', 'denied', 'refused'],
  withdrawn: ['withdrew', 'withdrawn'],
  lapsed: ['cancelled', 'canceled', 'lapsed'],
  pending: ['pending'],
};

function guessColumn(headers, fieldKey) {
  const synonyms = FIELD_SYNONYMS[fieldKey] || [];
  const normalizedHeaders = headers.map((h) => String(h).toLowerCase().trim());
  for (const syn of synonyms) {
    const idx = normalizedHeaders.indexOf(syn);
    if (idx !== -1) return headers[idx];
  }
  // loose contains-match fallback
  for (const syn of synonyms) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(syn));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// Step 1 of bob-schema.md's import flow: suggest a mapping for the frontend's
// confirm-before-commit preview screen. Frontend calls this first, lets the
// user edit any guess, then POSTs the final mapping to /commit below.
router.post('/suggest-mapping', (req, res) => {
  const { rows } = req.body; // parsed rows as an array of objects, already read client-side or via /parse
  if (!rows || !rows.length) return res.status(400).json({ error: 'No rows provided.' });

  const headers = Object.keys(rows[0]);
  const mapping = {};
  Object.keys(FIELD_SYNONYMS).forEach((fieldKey) => {
    mapping[fieldKey] = guessColumn(headers, fieldKey);
  });

  res.json({ headers, suggestedMapping: mapping, previewRows: rows.slice(0, 3), totalRows: rows.length });
}
);

// Parses whatever numeric-looking text is in a cell; if it fails, checks it
// against the status keyword list per bob-schema.md's recovery logic.
function parseNumericOrRecoverStatus(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { value: null, recoveredStatus: null };
  }
  const asString = String(rawValue).trim();
  const asNumber = Number(asString.replace(/[$,]/g, ''));
  if (!Number.isNaN(asNumber) && asString !== '') {
    return { value: asNumber, recoveredStatus: null };
  }
  const lower = asString.toLowerCase();
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { value: null, recoveredStatus: status };
    }
  }
  return { value: null, recoveredStatus: 'UNRECOGNIZED', rawText: asString };
}

// Step 3 of bob-schema.md's import flow: row-by-row commit, given a confirmed mapping.
// POST body: { rows: [...], mapping: { clientName: 'FULL NAME', carrier: 'CARRIER', ... } }
router.post('/commit', async (req, res) => {
  const { rows, mapping } = req.body;
  if (!rows || !mapping) return res.status(400).json({ error: 'rows and mapping are required.' });

  const producerId = req.producerId;
  const summary = { clientsCreated: 0, clientsMatched: 0, policiesCreated: 0, commissionEntries: 0, remindersScheduled: 0, skipped: [] };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for header row, +1 for 1-indexing

    try {
      const clientName = mapping.clientName ? row[mapping.clientName] : null;
      const carrier = mapping.carrier ? row[mapping.carrier] : null;

      let { value: monthlyPremium, recoveredStatus } = mapping.monthlyPremium
        ? parseNumericOrRecoverStatus(row[mapping.monthlyPremium])
        : { value: null, recoveredStatus: null };

      // bob-schema.md finding #4: rows with no carrier and no premium are sparse
      // application-only records — excluded from the policy table, reported separately.
      if (!clientName || (!carrier && monthlyPremium === null && !recoveredStatus)) {
        summary.skipped.push({ row: rowNumber, reason: 'Incomplete record (no carrier or premium) — not imported.' });
        continue; // eslint-disable-line no-continue
      }

      if (recoveredStatus === 'UNRECOGNIZED') {
        summary.skipped.push({ row: rowNumber, reason: `Unparsable premium value, no recognizable status keyword: "${row[mapping.monthlyPremium]}"` });
        continue; // eslint-disable-line no-continue
      }

      // find-or-create client, scoped to this producer, matched by exact name (v1 policy — see bob-schema.md)
      let client = await prisma.client.findFirst({ where: { producerId, name: clientName } });
      if (client) {
        summary.clientsMatched += 1;
      } else {
        client = await prisma.client.create({
          data: {
            producerId,
            name: clientName,
            contactInfo: {
              phone: mapping.phone ? row[mapping.phone] || null : null,
              email: mapping.email ? row[mapping.email] || null : null,
            },
          },
        });
        summary.clientsCreated += 1;
      }

      const statusRaw = mapping.status ? String(row[mapping.status] || '').toLowerCase() : '';
      let status = recoveredStatus && recoveredStatus !== 'UNRECOGNIZED' ? recoveredStatus : null;
      if (!status) {
        if (statusRaw.includes('approv') || statusRaw.includes('paid')) status = 'active';
        else if (statusRaw.includes('declin') || statusRaw.includes('refus')) status = 'declined';
        else if (statusRaw.includes('withdr')) status = 'withdrawn';
        else if (statusRaw.includes('cancel') || statusRaw.includes('laps')) status = 'lapsed';
        else if (statusRaw.includes('pending')) status = 'pending';
        else status = monthlyPremium ? 'active' : 'pending';
      }

      const issueDateRaw = mapping.issueDate ? row[mapping.issueDate] : null;
      const issueDate = issueDateRaw ? new Date(issueDateRaw) : new Date();

      const policy = await prisma.policy.create({
        data: {
          clientId: client.id,
          policyNumber: mapping.policyNumber ? String(row[mapping.policyNumber] || '') || null : null,
          carrier: carrier || 'Unknown',
          productType: mapping.productType ? row[mapping.productType] || 'Unknown' : 'Unknown',
          faceAmount: mapping.faceAmount ? Number(row[mapping.faceAmount]) || null : null,
          monthlyPremium: monthlyPremium || 0,
          issueDate,
          status,
          leadType: mapping.leadType ? row[mapping.leadType] || null : null,
          leadVendor: mapping.leadVendor ? row[mapping.leadVendor] || null : null,
        },
      });
      summary.policiesCreated += 1;

      if (status === 'active') {
        const reminders = buildReminderDates(policy.issueDate);
        await prisma.paymentReminder.createMany({
          data: reminders.map((r) => ({ policyId: policy.id, monthsAfterIssue: r.monthsAfterIssue, reminderDate: r.reminderDate })),
        });
        summary.remindersScheduled += reminders.length;
      }

      // Commission entries — advance / additional / chargeback, per mapped columns.
      const commissionRows = [
        { key: 'advanceCommission', entryType: 'advance' },
        { key: 'additionalCommission', entryType: 'additional' },
        { key: 'chargeback', entryType: 'chargeback' },
      ];
      for (const { key, entryType } of commissionRows) {
        if (!mapping[key]) continue; // eslint-disable-line no-continue
        const { value } = parseNumericOrRecoverStatus(row[mapping[key]]);
        if (value === null || value === 0) continue; // eslint-disable-line no-continue
        await prisma.commissionEntry.create({
          data: {
            policyId: policy.id,
            ownerType: 'producer',
            producerId,
            entryType,
            amount: entryType === 'chargeback' ? -Math.abs(value) : value,
            entryDate: issueDate,
            notes: 'Imported from spreadsheet',
          },
        });
        summary.commissionEntries += 1;
      }
    } catch (err) {
      summary.skipped.push({ row: rowNumber, reason: `Import error: ${err.message}` });
    }
  }

  res.json(summary);
});

// Convenience endpoint: accepts an uploaded XLSX/CSV (as base64 in the body for
// this scaffold — swap for multipart/form-data + multer in the real build) and
// returns parsed rows per sheet, ready to feed into /suggest-mapping.
router.post('/parse-workbook', (req, res) => {
  const { base64, sheetName } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 file content is required.' });

  const workbook = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer', cellDates: true });
  const targetSheet = sheetName || workbook.SheetNames[0];
  if (!workbook.Sheets[targetSheet]) {
    return res.status(400).json({ error: `Sheet "${targetSheet}" not found.`, availableSheets: workbook.SheetNames });
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { defval: null });
  res.json({ sheetName: targetSheet, availableSheets: workbook.SheetNames, rows });
});

module.exports = router;
