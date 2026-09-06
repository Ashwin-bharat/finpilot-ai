import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as zlib from 'zlib';

const prisma = new PrismaClient();

const BSE_DIRECT_CSV_URL = 'https://www.bseindia.com/downloads1/List_of_companies.csv';
const BSE_ACTIVE_EQUITY_API_URL =
  'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active';

/**
 * Fetch data from BSE API using https with decompression and lenient parser
 */
function fetchBseActiveScrips(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      BSE_ACTIVE_EQUITY_API_URL,
      {
        insecureHTTPParser: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          Referer: 'https://www.bseindia.com/',
          Origin: 'https://www.bseindia.com',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`BSE API returned HTTP ${res.statusCode} ${res.statusMessage}`));
        }

        let stream: NodeJS.ReadableStream = res;
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        }

        let data = '';
        stream.on('data', (chunk) => {
          data += chunk;
        });
        stream.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) {
              return reject(new Error('BSE API response is not an array'));
            }
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse BSE JSON response: ${err}`));
          }
        });
        stream.on('error', reject);
      },
    );

    req.on('error', reject);
  });
}

async function checkDirectCsvUrl(): Promise<{ status: string; detail: string }> {
  try {
    const res = await fetch(BSE_DIRECT_CSV_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://www.bseindia.com/corporates/List_Scrips.html',
      },
    });

    const text = await res.text();
    if (text.includes('List of GSM companies')) {
      return {
        status: 'SURVEILLANCE_LIST_ONLY',
        detail:
          'Direct CSV URL (List_of_companies.csv) returned GSM surveillance list (~700 companies) rather than full 5,000+ active equity security master.',
      };
    }
    return { status: 'SUCCESS', detail: `Received ${text.length} bytes.` };
  } catch (err: any) {
    return { status: 'FAILED', detail: err.message };
  }
}

async function importBseStocks() {
  console.log('--- BSE Official Security Master Import ---');
  console.log('Step 1: Testing direct BSE CSV URL (https://www.bseindia.com/downloads1/List_of_companies.csv)...');
  const csvCheck = await checkDirectCsvUrl();
  console.log(`Direct CSV probe status: [${csvCheck.status}] - ${csvCheck.detail}`);

  console.log('Step 2: Fetching full active equity security master from official BSE Corporate API...');
  const scripList = await fetchBseActiveScrips();
  console.log(`Received ${scripList.length} total active equity securities from BSE!`);

  const initialDbCount = await prisma.stock.count();
  const initialNseCount = await prisma.stock.count({ where: { exchange: 'NSE' } });
  const initialBseCount = await prisma.stock.count({ where: { exchange: 'BSE' } });

  console.log(`\nCurrent Database State:`);
  console.log(`- Total stocks in DB: ${initialDbCount}`);
  console.log(`- NSE listed stocks: ${initialNseCount}`);
  console.log(`- BSE listed stocks: ${initialBseCount}`);

  // Format and validate records
  const recordsToImport: { symbol: string; name: string }[] = [];
  const seenSymbols = new Set<string>();

  for (const item of scripList) {
    const rawSym = (item.scrip_id || item.SCRIP_CD || '').trim().toUpperCase();
    if (!rawSym) continue;

    const symbol = `${rawSym}.BO`;
    if (seenSymbols.has(symbol)) continue;
    seenSymbols.add(symbol);

    const name = (item.Scrip_Name || item.Issuer_Name || rawSym).trim();
    recordsToImport.push({
      symbol,
      name,
    });
  }

  console.log(`\nStep 3: Upserting ${recordsToImport.length} BSE equities into PostgreSQL database...`);

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
            exchange: 'BSE',
          },
          create: {
            symbol: item.symbol,
            name: item.name,
            sector: 'Diversified',
            industry: 'General',
            exchange: 'BSE',
            currency: 'INR',
          },
        }),
      ),
    );
    importedCount += chunk.length;
    process.stdout.write(`Imported ${importedCount}/${recordsToImport.length} BSE stocks...\r`);
  }

  console.log(`\nSuccessfully imported and indexed ${importedCount} official BSE stock symbols!`);

  const finalTotalCount = await prisma.stock.count();
  const finalNseCount = await prisma.stock.count({ where: { exchange: 'NSE' } });
  const finalBseCount = await prisma.stock.count({ where: { exchange: 'BSE' } });

  console.log(`\n=== FINAL UNIFIED SECURITY MASTER SUMMARY ===`);
  console.log(`- Total Stocks in DB: ${finalTotalCount}`);
  console.log(`- NSE Listed Stocks (.NS): ${finalNseCount}`);
  console.log(`- BSE Listed Stocks (.BO): ${finalBseCount}`);

  await prisma.$disconnect();
}

importBseStocks().catch((err) => {
  console.error('BSE stock import script failed:', err);
  process.exit(1);
});
