require('dotenv').config();
const prisma = require('../src/lib/db');
// Pass a seed-data module path as the first CLI arg to load a different batch, e.g.:
//   node prisma/seed-imo-rates.js ./seed-data/ffl-srs-guide-2024
const dataModule = process.argv[2] || './seed-data/ffl-comp-guide-2026-v7';
const { IMO_NAME, LEVELS, PRODUCTS } = require(dataModule);

async function main() {
  const rows = [];
  for (const { carrier, product, rates } of PRODUCTS) {
    LEVELS.forEach((level, i) => {
      if (rates[i] !== null) {
        rows.push({
          imoName: IMO_NAME,
          carrierName: carrier,
          productName: product,
          contractLevel: level,
          payoutRate: rates[i],
        });
      }
    });
  }

  console.log(`Seeding ${rows.length} rate rows for "${IMO_NAME}"...`);
  for (const row of rows) {
    await prisma.imoCommissionRate.upsert({
      where: {
        imoName_carrierName_productName_contractLevel: {
          imoName: row.imoName,
          carrierName: row.carrierName,
          productName: row.productName,
          contractLevel: row.contractLevel,
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
