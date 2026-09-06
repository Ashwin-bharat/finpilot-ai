import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NSE_EQUITY_CSV_URL = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function importNseStocks() {
  console.log('Fetching official NSE equities CSV from archives...');

  const response = await fetch(NSE_EQUITY_CSV_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download NSE CSV. HTTP Status: ${response.status} ${response.statusText}`);
  }

  const csvContent = await response.text();

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  console.log(`Total CSV lines received: ${lines.length}`);
  const header = parseCsvLine(lines[0]);
  const symbolIdx = header.findIndex((h) => h.toUpperCase().includes('SYMBOL'));
  const nameIdx = header.findIndex((h) => h.toUpperCase().includes('NAME OF COMPANY'));
  const seriesIdx = header.findIndex((h) => h.toUpperCase().includes('SERIES'));

  if (symbolIdx === -1 || nameIdx === -1) {
    throw new Error('CSV headers missing SYMBOL or NAME OF COMPANY fields');
  }

  const recordsToImport: { symbol: string; name: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(symbolIdx, nameIdx)) continue;

    const rawSymbol = row[symbolIdx];
    const companyName = row[nameIdx];
    const series = seriesIdx !== -1 ? row[seriesIdx] : 'EQ';

    // Filter to Equity series (EQ)
    if (series !== 'EQ') continue;
    if (!rawSymbol || !companyName) continue;

    const cleanSymbol = `${rawSymbol.toUpperCase().trim()}.NS`;
    recordsToImport.push({
      symbol: cleanSymbol,
      name: companyName.trim(),
    });
  }

  console.log(`Parsed ${recordsToImport.length} equity (EQ) symbols for database import.`);

  let importedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < recordsToImport.length; i += batchSize) {
    const chunk = recordsToImport.slice(i, i + batchSize);
    await Promise.all(
      chunk.map((item) =>
        prisma.stock.upsert({
          where: { symbol: item.symbol },
          update: {
            name: item.name,
          },
          create: {
            symbol: item.symbol,
            name: item.name,
            sector: 'Diversified',
            industry: 'General',
            exchange: 'NSE',
            currency: 'INR',
          },
        }),
      ),
    );
    importedCount += chunk.length;
    process.stdout.write(`Imported ${importedCount}/${recordsToImport.length} stocks...\r`);
  }

  console.log(`\nSuccessfully imported and indexed ${importedCount} official NSE stock symbols into PostgreSQL database!`);

  const totalInDb = await prisma.stock.count();
  console.log(`Total stocks currently in database: ${totalInDb}`);

  await prisma.$disconnect();
}

importNseStocks().catch((err) => {
  console.error('NSE stock import script failed:', err);
  process.exit(1);
});
