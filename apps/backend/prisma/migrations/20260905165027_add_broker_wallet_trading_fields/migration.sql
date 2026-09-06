-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('PAPER', 'LIVE');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'PAPER_TRADE_DEBIT', 'PAPER_TRADE_CREDIT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "live_trading_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trading_mode" "TradingMode" NOT NULL DEFAULT 'PAPER';

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "description" TEXT,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "reference_trade_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broker_name" TEXT NOT NULL DEFAULT 'ANGEL_ONE',
    "client_code" TEXT NOT NULL,
    "encrypted_pin" TEXT NOT NULL,
    "encrypted_totp_secret" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "encrypted_jwt_token" TEXT,
    "encrypted_refresh_token" TEXT,
    "encrypted_feed_token" TEXT,
    "session_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broker_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "order_type" TEXT NOT NULL DEFAULT 'MARKET',
    "trading_mode" "TradingMode" NOT NULL,
    "broker_order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "status_message" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "broker_credentials_user_id_key" ON "broker_credentials"("user_id");

-- CreateIndex
CREATE INDEX "stocks_name_idx" ON "stocks"("name");

-- CreateIndex
CREATE INDEX "stocks_symbol_name_idx" ON "stocks"("symbol", "name");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_credentials" ADD CONSTRAINT "broker_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_orders" ADD CONSTRAINT "broker_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
