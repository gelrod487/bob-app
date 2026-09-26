// Transcribed from Family First Life's "2026 Comp Guide v7" (revised 08/26/2026),
// pages 1-6, by visual review of the rendered PDF pages (the source document uses
// graphic tables, not extractable text). Spot-checked against a high-resolution
// re-render for one value that looked like an outlier (American Amicable XUL at
// contract level 70 reads 76%, breaking the otherwise-monotonic pattern around it —
// confirmed present in the source at 400dpi, so transcribed as-is rather than
// "corrected"). Given the volume (~50 columns x 17 rows), treat this as a strong
// first pass — worth spot-checking against the PDF, and any correction can be made
// directly in the app once the "edit rate" UI exists, without needing a new seed run.
//
// LEVELS are the FFL Contract percentages this guide is keyed by, high to low.
// Each product's `rates` array lines up 1:1 with LEVELS; null means "not offered at
// that contract level" (printed as "-" in the source).

const IMO_NAME = 'Family First Life';

const LEVELS = [145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65];

const PRODUCTS = [
  // --- Page 1 ---
  { carrier: 'Aetna', product: 'Whole Life', rates: [null, 144, 137, 130, 125, 120, 115, 107.5, 100, 92.5, 85, 77.5, 70, 70, 70, 70, 70] },
  { carrier: 'Aflac', product: 'Final EX', rates: [null, 123, 118, 113, 108, 100, 93, 85, 78, 70, 70, 70, 63, 63, 63, 63, 63] },
  { carrier: 'Americo', product: 'HMS 125', rates: [145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65] },
  { carrier: 'Americo', product: 'Eagle Premier', rates: [135, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60] },

  // --- Page 2 ---
  { carrier: 'American Amicable', product: 'Senior/Family Choice', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'American Amicable', product: 'EZ Term', rates: [100, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25] },
  { carrier: 'American Amicable', product: 'Secure Life', rates: [140, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65] },
  { carrier: 'American Amicable', product: 'Home Protector', rates: [145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65] },
  { carrier: 'American Amicable', product: 'OBA', rates: [100, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 30] },
  { carrier: 'American Amicable', product: 'Term Made Simple', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },
  { carrier: 'American Amicable', product: 'Family Protector', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },
  { carrier: 'American Amicable', product: 'XUL', rates: [105, 105, 100, 95, 90, 85, 80, 75, 70, 76, 60, 55, 50, 45, 45, 45, 45] },
  { carrier: 'Corebridge', product: 'GIWL', rates: [null, 80.0, 77.5, 75.0, 72.5, 70.0, 67.5, 65.0, 62.5, 60.0, 57.5, 57.5, 55.0, 55.0, 55.0, 55.0, 55.0] },
  { carrier: 'Corebridge', product: 'SIWL', rates: [null, 132, 127, 122, 117, 112, 107, 102, 97, 92, 87, 82, 77, 72, 67, 62, 57] },

  // --- Page 3: Ethos ---
  { carrier: 'Ethos', product: 'Term Life - Prime', rates: [120, 117.5, 115, 112.5, 110, 107.5, 105, 102.5, 100, 97.5, 95, 92.5, 90, 87.5, 85, 82.5, 80] },
  { carrier: 'Ethos', product: 'Term Life - Choice', rates: [120, 117.5, 115, 112.5, 110, 107.5, 105, 102.5, 100, 97.5, 95, 92.5, 90, 87.5, 85, 82.5, 80] },
  { carrier: 'Ethos', product: 'TruStage Term Life', rates: [120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 50, 50] },
  { carrier: 'Ethos', product: 'Index Universal Life', rates: [125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45] },
  { carrier: 'Ethos', product: 'Accumulation IUL (First Year)', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'Ethos', product: 'TruStage Advantage Whole Life', rates: [120, 120, 115, 110, 105, 100, 95, 90, 85, 82.5, 80, 77.5, 75, 72.5, 65, 60, 55] },
  { carrier: 'Ethos', product: 'TAWL Max % (Age Band 60-80)', rates: [120, 120, 115, 110, 105, 100, 95, 90, 85, 82.5, 80, 77.5, 75, 72.5, 65, 60, 55] },
  { carrier: 'Ethos', product: 'TAWL Max % (Age Band 20-59 and 80+)', rates: [72, 72, 67, 62, 59, 56, 53, 50, 47, 45.5, 44, 42.5, 41, 39, 39.5, 39.5, 39.5] },
  { carrier: 'Ethos', product: 'TruStage Guaranteed Acceptance Whole Life', rates: [30, 27.5, 25, 22.5, 20, 17.5, 15, 12.5, 10, 7.5, 5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5] },
  { carrier: 'Ethos', product: 'TruStage Accidental Death', rates: [85, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 25, 25, 25] },

  // --- Page 4 ---
  { carrier: 'Foresters', product: 'Strong Foundation', rates: [null, 125, 122.5, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 60] },
  { carrier: 'Foresters', product: 'Planright', rates: [null, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65] },
  { carrier: 'Liberty Bankers', product: 'FX', rates: [null, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'Ladder Life', product: 'FX', rates: [null, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 50, 50, 50] },
  { carrier: 'National Life Group (NLG)', product: 'Universal Life', rates: [null, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 40] },

  // --- Page 5 ---
  { carrier: 'Mutual of Omaha', product: 'Term Life Express', rates: [145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65] },
  { carrier: 'Mutual of Omaha', product: 'Final Expense', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 86, 82, 78, 74, 70, 65, 61, 57] },
  { carrier: 'Mutual of Omaha', product: 'IUL', rates: [125, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] },
  { carrier: 'Mutual of Omaha', product: "Children's Whole Life", rates: [100, 100, 97, 95, 92, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35] },
  { carrier: 'Mutual of Omaha', product: 'IULE', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },
  { carrier: 'Mutual of Omaha', product: 'Term Life Answers', rates: [110, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35] },
  { carrier: 'Mutual of Omaha', product: 'Accidental Death', rates: [130, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55] },
  { carrier: 'Royal Neighbors', product: 'Term', rates: [null, 120, 115, 110, 100, 100, 100, 95, 90, 85, 80, 75, 50, 50, 50, 50, 50] },
  { carrier: 'Royal Neighbors', product: 'Royal Legacy SPWL', rates: [null, 16, 15, 14, 13, 13, 13, 13, 12, 11, 10, 9, 7, 7, 7, 7, 7] },
  { carrier: 'Royal Neighbors', product: 'Secure Life IUL', rates: [null, 125, 120, 112, 105, 105, 105, 100, 95, 90, 85, 80, 50, 50, 50, 50, 50] },
  { carrier: 'Royal Neighbors', product: 'SI Whole Life', rates: [null, 125, 120, 110, 100, 100, 100, 95, 90, 85, 80, 75, 45, 45, 45, 45, 45] },

  // --- Page 6 ---
  { carrier: 'Transamerica', product: 'FE', rates: [140, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 70] },
  { carrier: 'Transamerica', product: 'UL', rates: [120, 120, 115, 110, 105, 100, 95, 90, 80, 75, 70, 60, 55, 50, 45, 40, 40] },
  { carrier: 'United Home Life', product: 'FX', rates: [null, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 45, 45] },
  { carrier: 'United Home Life', product: 'GIWL', rates: [null, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 25, 25, 25, 25, 25, 25] },
  { carrier: 'United Home Life', product: 'Whole Life', rates: [null, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 55] },
  { carrier: 'United Home Life', product: 'Accidental', rates: [null, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 50, 50, 45, 45, 45] },
  { carrier: 'United Home Life', product: 'Term', rates: [null, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 45, 45] },
];

module.exports = { IMO_NAME, LEVELS, PRODUCTS };
