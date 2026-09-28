require('dotenv').config();
const prisma = require('../src/lib/db');
// Pass a seed-data module path as the first CLI arg to load a different batch.
const dataModule = process.argv[2] || './seed-data/ffl-annuity-comp-guide-2024';
const { IMO_NAME, TIERS, PRODUCTS } = require(dataModule);

async function main() {
  const rows = [];
  for (const { carrier, product, rates } of PRODUCTS) {
    TIERS.forEach((tier, i) => {
      if (rates[i] !== null && rates[i] !== undefined) {
        rows.push({
          imoName: IMO_NAME,
          carrierName: carrier,
          productName: product,
          tier,
          payoutRate: rates[i],
        });
      }
    });
  }

  console.log(`Seeding ${rows.length} annuity rate rows for "${IMO_NAME}"...`);
  for (const row of rows) {
    await prisma.annuityCommissionRate.upsert({
      where: {
        imoName_carrierName_productName_tier: {
          imoName: row.imoName,
          carrierName: row.carrierName,
          productName: row.productName,
          tier: row.tier,
        },
      },
      create: row,
      update: { payoutRate: row.payoutRate },
    });
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
