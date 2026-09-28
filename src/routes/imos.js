const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { getKnownImoNames } = require('../lib/knownImos');

const router = express.Router();

// GET /api/imos — every IMO name already known to BOB, for the Settings page's IMO
// autocomplete. See getKnownImoNames's doc comment for how it's sourced and deduped.
router.get('/', asyncHandler(async (req, res) => {
  const imos = await getKnownImoNames();
  res.json({ imos });
}));

module.exports = router;
