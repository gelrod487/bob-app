const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/analytics — a pure eligibility check for the Analytics tab (Producer Plus,
// Agency Owner, or anyone still inside their 14-day trial — see requireProducerPlusOrAbove
// in middleware/tier.js). The tab's actual data is composed client-side from
// /api/policies, /api/activity, /api/expenses, and /api/dashboard — those stay ungated
// since every tier already uses them for their own core tabs (Desk/Activity/Costs/Profit)
// and expose nothing a lower tier doesn't already have. This endpoint exists purely so
// "Analytics is a Producer Plus feature" is actually enforced somewhere server-side,
// instead of just a hidden nav button a technical user could route around.
router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true });
}));

module.exports = router;
