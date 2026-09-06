import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CryptoSeedItem {
  symbol: string;
  name: string;
  category: string;
}

export const SEED_CRYPTO_ASSETS: CryptoSeedItem[] = [
  { symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1' },
  { symbol: 'ETH', name: 'Ethereum', category: 'Layer 1' },
  { symbol: 'SOL', name: 'Solana', category: 'Layer 1' },
  { symbol: 'BNB', name: 'BNB', category: 'Layer 1' },
  { symbol: 'XRP', name: 'XRP', category: 'Payment / Settlement' },
  { symbol: 'ADA', name: 'Cardano', category: 'Layer 1' },
  { symbol: 'DOGE', name: 'Dogecoin', category: 'Meme' },
  { symbol: 'AVAX', name: 'Avalanche', category: 'Layer 1' },
  { symbol: 'LINK', name: 'Chainlink', category: 'Oracle / Infra' },
  { symbol: 'SUI', name: 'Sui', category: 'Layer 1' },
  { symbol: 'SHIB', name: 'Shiba Inu', category: 'Meme' },
  { symbol: 'DOT', name: 'Polkadot', category: 'Layer 0' },
  { symbol: 'NEAR', name: 'NEAR Protocol', category: 'Layer 1' },
  { symbol: 'UNI', name: 'Uniswap', category: 'DeFi' },
  { symbol: 'LTC', name: 'Litecoin', category: 'Payment' },
  { symbol: 'BCH', name: 'Bitcoin Cash', category: 'Payment' },
  { symbol: 'MATIC', name: 'Polygon', category: 'Layer 2' },
  { symbol: 'APT', name: 'Aptos', category: 'Layer 1' },
  { symbol: 'ICP', name: 'Internet Computer', category: 'Infrastructure' },
  { symbol: 'ATOM', name: 'Cosmos', category: 'Layer 0' },
  { symbol: 'ARB', name: 'Arbitrum', category: 'Layer 2' },
  { symbol: 'OP', name: 'Optimism', category: 'Layer 2' },
  { symbol: 'INJ', name: 'Injective', category: 'DeFi / Layer 1' },
  { symbol: 'FIL', name: 'Filecoin', category: 'Storage' },
  { symbol: 'XLM', name: 'Stellar', category: 'Payment' },
  { symbol: 'AAVE', name: 'Aave', category: 'DeFi' },
  { symbol: 'RENDER', name: 'Render Network', category: 'AI / Compute' },
  { symbol: 'FET', name: 'Artificial Superintelligence Alliance', category: 'AI' },
  { symbol: 'TIA', name: 'Celestia', category: 'Modular Infra' },
  { symbol: 'STX', name: 'Stacks', category: 'Bitcoin Layer 2' },
];

export async function seedCryptoAssets() {
  console.log(`[SeedCrypto] Seeding ${SEED_CRYPTO_ASSETS.length} cryptocurrency assets...`);

  for (const asset of SEED_CRYPTO_ASSETS) {
    await prisma.cryptoAsset.upsert({
      where: { symbol: asset.symbol },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
      },
      update: {
        name: asset.name,
        category: asset.category,
      },
    });
  }

  const count = await prisma.cryptoAsset.count();
  console.log(`[SeedCrypto] Successfully verified ${count} crypto assets in database.`);
}

if (require.main === module) {
  seedCryptoAssets()
    .catch((e) => {
      console.error('[SeedCrypto] Error seeding crypto assets:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
