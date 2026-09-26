// Transcribed from "Family First Life SRS" contracting guidelines (SRS_Contracting_
// Guidelines_v12025.pdf, revised 08/19/2024), pages 2-7 — the IUL, Term, and IBC comp
// guides, all keyed by the same 65-145 FFL Contract Level ladder as the main guide.
// Page 1 (Annuity Comp Guide) is deliberately excluded: it uses a completely different
// structure (named production tiers based on lifetime $ volume — Green/Yellow/Blue/
// Silver/Gold/Platinum/Black/Royal/Red — not a contract %), which doesn't fit this
// calculator's contract-level model. Needs its own design if wanted later.
//
// Two products here (Ethos/Ameritas, Transamerica/FFL IUL) have identical rates to
// existing entries under different names (Ethos/Index Universal Life, Transamerica/UL)
// from the main comp guide — confirmed with Gustin these are additional/distinct
// products, not the same one renamed, so both are kept as separate rows.

const IMO_NAME = 'Family First Life';
const LEVELS = [145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65];

const PRODUCTS = [
  // --- Page 2: IUL Comp Guide ---
  { carrier: 'Allianz', product: 'Allianz Life PRO+', rates: [105, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30] },
  { carrier: 'Americo', product: 'Instant Decision', rates: [130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'American National', product: 'Signature Performance IUL', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60, 60, 60, 60, 60] },
  { carrier: 'American National', product: 'Signature Protection IUL', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60, 60, 60, 60, 60] },
  { carrier: 'American National', product: 'Signature GUL', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60, 60, 60, 60, 60] },
  { carrier: 'Columbus Life', product: 'Indexed Explorer Plus', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60] },
  { carrier: 'Columbus Life', product: 'Indexed Explorer Now', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60] },
  { carrier: 'Columbus Life', product: 'Survivorship IUL', rates: [100, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60, 60, 60, 60, 60, 60, 60] },

  // --- Page 3: IUL Comp Guide (continued) ---
  { carrier: 'Ethos', product: 'Ameritas', rates: [125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45] },
  { carrier: 'Fidelity & Guaranty (F&G)', product: 'Pathsetter 0-17', rates: [95, 95, 90, 87.5, 85, 82.5, 80, 77.5, 75, 72.5, 70, 67.5, 65, 62.5, 60, 55, 50] },
  { carrier: 'Fidelity & Guaranty (F&G)', product: 'Pathsetter 18-80', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },
  { carrier: 'Fidelity & Guaranty (F&G)', product: 'Everlast 0-17', rates: [95, 95, 90, 87.5, 85, 82.5, 80, 77.5, 75, 72.5, 70, 67.5, 65, 62.5, 60, 55, 50] },
  { carrier: 'Fidelity & Guaranty (F&G)', product: 'Everlast 18-80', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'Mutual of Omaha', product: 'UL', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'Mutual of Omaha', product: 'IULE (SRS)', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },

  // --- Page 4: IUL Comp Guide (continued) ---
  { carrier: 'National Life Group (NLG)', product: 'Flex Life IUL', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 40] },
  { carrier: 'National Life Group (NLG)', product: 'SummitLife IUL', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 40] },
  { carrier: 'North American', product: 'Builders Plus IUL', rates: [120, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 55] },
  { carrier: 'North American', product: 'Protection Builder IUL', rates: [115, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 50, 50] },
  { carrier: 'North American', product: 'Smart Builder 3 IUL', rates: [115, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 50, 50] },
  { carrier: 'Transamerica', product: 'FFL IUL', rates: [120, 120, 115, 110, 105, 100, 95, 90, 80, 75, 70, 60, 55, 50, 45, 40, 40] },

  // --- Page 5: Term Comp Guide ---
  { carrier: 'Columbus Life', product: 'Nautical Term (10/15/20/30 YR)', rates: [75, 75, 70, 65, 60, 55, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50] },
  { carrier: 'National Life Group (NLG)', product: '10/15 YR Term', rates: [92, 92, 88, 83, 80, 75, 71, 67, 62, 58, 55, 50, 45, 42, 38, 33, 33] },
  { carrier: 'National Life Group (NLG)', product: '20/30 YR Term', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 40] },
  { carrier: 'North American', product: 'Advantage Term 10 YR', rates: [95, 95, 90, 85, 80, 75, 70, 65, 60, 57.5, 55, 52.5, 50, 47.5, 45, 45, 45] },
  { carrier: 'North American', product: 'Advantage Term 15 YR', rates: [100, 100, 95, 90, 85, 80, 75, 70, 65, 62.5, 60, 57.5, 55, 52.5, 50, 50, 50] },
  { carrier: 'North American', product: 'Advantage Term 20 YR', rates: [120, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 55] },
  { carrier: 'North American', product: 'Advantage Term 30 YR', rates: [120, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 55] },

  // --- Page 6: Term Comp Guide (continued) ---
  { carrier: 'Sagicor Life', product: '10 YR Term', rates: [99, 99, 93, 93, 93, 87, 87, 87, 87, 81, 81, 81, 81, 70, 70, 70, 70] },
  { carrier: 'Sagicor Life', product: '15 YR Term', rates: [111, 111, 105, 105, 105, 97, 97, 97, 97, 89, 89, 89, 89, 77, 77, 77, 77] },
  { carrier: 'Sagicor Life', product: '20 YR Term', rates: [121, 121, 116, 116, 116, 105, 105, 105, 105, 95, 95, 95, 95, 84, 84, 84, 84] },

  // --- Page 7: IBC Comp Guide ---
  { carrier: 'Lafayette Life Insurance Company', product: 'IBC Whole Life', rates: [110, 110, 105, 100, 95, 90, 85, 80, 70, 65, 60, 55, 55, 55, 55, 55, 55] },
];

module.exports = { IMO_NAME, LEVELS, PRODUCTS };
