import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { WalletTransactionType, WalletTransactionStatus } from '@prisma/client';
import * as crypto from 'crypto';

describe('WalletService Unit Tests', () => {
  jest.setTimeout(30000);
  let service: WalletService;
  let prismaMock: any;

  const mockUserId = 'user-test-uuid-456';
  const mockWallet = {
    id: 'wallet-test-123',
    userId: mockUserId,
    balance: 5000.0,
    currency: 'INR',
    createdAt: new Date(),
    updatedAt: new Date(),
    transactions: [],
  };

  beforeEach(async () => {
    prismaMock = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue(mockWallet),
        create: jest.fn().mockResolvedValue(mockWallet),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...mockWallet,
            ...data,
          }),
        ),
      },
      walletTransaction: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'wtx-999',
            ...data,
            createdAt: new Date(),
          }),
        ),
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: 'wtx-pending-1',
            walletId: mockWallet.id,
            type: WalletTransactionType.TOPUP,
            amount: 1000.0,
            status: WalletTransactionStatus.PENDING,
            razorpayOrderId: where.razorpayOrderId,
            createdAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'wtx-pending-1',
            walletId: mockWallet.id,
            type: WalletTransactionType.TOPUP,
            amount: 1000.0,
            ...data,
            createdAt: new Date(),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  describe('getOrCreateWallet', () => {
    it('returns existing wallet for user', async () => {
      const wallet = await service.getOrCreateWallet(mockUserId);
      expect(wallet.id).toBe(mockWallet.id);
      expect(wallet.balance).toBe(5000.0);
      expect(wallet.currency).toBe('INR');
    });

    it('creates new wallet if none exists for user', async () => {
      prismaMock.wallet.findUnique.mockResolvedValueOnce(null);
      const wallet = await service.getOrCreateWallet('new-user-id');
      expect(prismaMock.wallet.create).toHaveBeenCalled();
      expect(wallet).toBeDefined();
    });
  });

  describe('createTopupOrder', () => {
    it('creates Razorpay top-up order and pending transaction', async () => {
      const res = await service.createTopupOrder(mockUserId, { amount: 1000 });

      expect(res.amount).toBe(100000); // in paise
      expect(res.amountInRupees).toBe(1000);
      expect(res.currency).toBe('INR');
      expect(res.orderId).toBeDefined();
      expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: mockWallet.id,
            type: WalletTransactionType.TOPUP,
            amount: 1000,
            status: WalletTransactionStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('verifyTopup', () => {
    it('successfully verifies valid Razorpay HMAC signature and credits wallet balance', async () => {
      const orderId = 'order_valid_123';
      const paymentId = 'pay_test_987';
      const secret = (service as any).razorpayKeySecret;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await service.verifyTopup(mockUserId, {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature,
        amount: 1000,
      });

      expect(res.success).toBe(true);
      expect(res.wallet.balance).toBe(6000.0); // 5000 + 1000
    });

    it('rejects invalid Razorpay signature with BadRequestException', async () => {
      await expect(
        service.verifyTopup(mockUserId, {
          razorpayOrderId: 'order_invalid',
          razorpayPaymentId: 'pay_invalid',
          razorpaySignature: 'totally_invalid_signature_hash',
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Paper Trade Debit / Credit', () => {
    it('debits paper trading wallet upon BUY order', async () => {
      const tx = await service.debitForPaperTrade(
        mockUserId,
        2500,
        'Paper BUY 1 TCS.NS',
        'order-ref-1',
      );

      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: 2500 }, // 5000 - 2500
        }),
      );
      expect(tx.type).toBe(WalletTransactionType.PAPER_TRADE_DEBIT);
    });

    it('credits paper trading wallet upon SELL order', async () => {
      const tx = await service.creditForPaperTrade(
        mockUserId,
        1500,
        'Paper SELL 1 TCS.NS',
        'order-ref-2',
      );

      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: 6500 }, // 5000 + 1500
        }),
      );
      expect(tx.type).toBe(WalletTransactionType.PAPER_TRADE_CREDIT);
    });
  });
});
