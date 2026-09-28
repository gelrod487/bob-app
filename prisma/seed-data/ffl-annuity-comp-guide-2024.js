// Transcribed from "Family First Life SRS Annuity Comp Guide" (page 1 of
// SRS_Contracting_Guidelines_v12025.pdf, revised 08/19/2024).
//
// Tiers are named PRODUCTION TIERS based on the producer's own lifetime annuity
// production (issued, not submitted) — not a contract %. Approximate lifetime issue-paid
// premium thresholds for each tier, per the guide: Green = new agent, Yellow = $100K,
// Blue = $500K (FFL contract 140 & 145 start here), Silver = $1M, Gold = $2M,
// Platinum = $5M (or $30M — guide lists both), Black = $10M (or $60M), Royal = $120M,
// Red = $175M. Promotions are calculated monthly (1st of the month) off lifetime
// production dating back to 2018-01-01.
const IMO_NAME = 'Family First Life';
const TIERS = ['green', 'yellow', 'blue', 'silver', 'gold', 'platinum', 'black', 'royal', 'red'];
const TIER_LABELS = {
  green: 'Green (New Agent)', yellow: 'Yellow ($100K)', blue: 'Blue ($500K)', silver: 'Silver ($1M)',
  gold: 'Gold ($2M)', platinum: 'Platinum ($5M)', black: 'Black ($10M)', royal: 'Royal ($120M)', red: 'Red ($175M)',
};

const PRODUCTS = [
  { carrier: 'Athene', product: 'Performance Elite 10', rates: [5.75, 6.5, 6.75, 7, 7.25, 7.5, 8, 8.5, 9] },
  { carrier: 'F&G Annuities & Life', product: 'Accumulator Plus 10', rates: [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9] },
  { carrier: 'ForeThought', product: 'Choice Accum 10', rates: [5, 5, 6, 6, 6.5, 7, 7.5, 8.5, 8.5] },
  { carrier: 'Legacy', product: 'Legacy Mark SE 10', rates: [5.25, 5.5, 6, 6.25, 6.5, 7, 7.25, 7.75, 8.25] },
  { carrier: 'Nassau', product: 'Nassau Growth Annuity 10 YR', rates: [5, 6.75, 6.75, 7.25, 7.75, 8.25, 8.25, 8.75, 9.25] },
  { carrier: 'National Life Group (NLG)', product: 'Zenith Growth 10', rates: [4.5, 5, 6, 6.25, 6.5, 6.75, 7, 7.5, 8] },
  { carrier: 'North American', product: 'Charter Plus', rates: [5.6, 5.95, 6.3, 6.65, 7, 7.25, 7.5, 8, 9] },
  { carrier: 'Silac Insurance Company', product: 'Denall 14', rates: [6.5, 6.75, 7, 7.25, 7.5, 7.75, 8, 8.25, 8.5] },
];

module.exports = { IMO_NAME, TIERS, TIER_LABELS, PRODUCTS };
