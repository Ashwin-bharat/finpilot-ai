import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PortfolioController } from '../src/portfolio/portfolio.controller';
import { PortfolioService } from '../src/portfolio/portfolio.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { MARKET_DATA_PROVIDER } from '../src/market/providers/market-data-provider.interface';

describe('Auth & Portfolio Integration Tests (E2E)', () => {
  let app: INestApplication;
  let mockAuthService: any;
  let mockPortfolioService: any;

  const mockUser = {
    id: 'user-e2e-1',
    email: 'integration@test.com',
    fullName: 'Integration Tester',
    createdAt: new Date().toISOString(),
  };

  const mockToken = 'mock_jwt_access_token';

  beforeAll(async () => {
    mockAuthService = {
      signup: jest.fn().mockImplementation((dto) => {
        return Promise.resolve({
          result: {
            user: { ...mockUser, email: dto.email, fullName: dto.fullName },
            tokens: { accessToken: mockToken, expiresIn: 900 },
          },
          refreshToken: 'mock_refresh_token_123',
        });
      }),
      login: jest.fn().mockImplementation((dto) => {
        return Promise.resolve({
          result: {
            user: mockUser,
            tokens: { accessToken: mockToken, expiresIn: 900 },
          },
          refreshToken: 'mock_refresh_token_123',
        });
      }),
    };

    const holdingsStore: any[] = [];
    mockPortfolioService = {
      getPortfolio: jest.fn().mockImplementation((userId) => {
        return Promise.resolve({
          id: 'port-e2e-1',
          userId,
          name: 'Main Portfolio',
          totalValue: holdingsStore.reduce((acc, h) => acc + h.currentValue, 0),
          dayChange: 0,
          dayChangePercent: 0,
          holdings: holdingsStore,
        });
      }),
      createTransaction: jest.fn().mockImplementation((userId, dto) => {
        const newHolding = {
          id: 'h-1',
          portfolioId: 'port-e2e-1',
          stock: {
            id: 'stock-tcs',
            symbol: dto.symbol,
            name: 'Tata Consultancy Services',
            sector: 'Technology',
            industry: 'IT',
            exchange: 'NSE',
            currency: 'INR',
            currentPrice: dto.price,
            change: 0,
            changePercent: 0,
          },
          quantity: dto.quantity,
          avgBuyPrice: dto.price,
          currentValue: dto.quantity * dto.price,
          totalReturn: 0,
          totalReturnPercent: 0,
        };
        holdingsStore.push(newHolding);

        return Promise.resolve({
          message: 'Transaction executed successfully',
          transaction: {
            id: 'tx-e2e-1',
            portfolioId: 'port-e2e-1',
            symbol: dto.symbol,
            type: dto.type,
            quantity: dto.quantity,
            price: dto.price,
            executedAt: new Date().toISOString(),
          },
        });
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, PortfolioController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PortfolioService, useValue: mockPortfolioService },
        {
          provide: MARKET_DATA_PROVIDER,
          useValue: { getQuote: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer mock_jwt_access_token')) {
            req.user = mockUser;
            return true;
          }
          return false;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Auth Flow Integration: Signup -> Login -> Get Profile', () => {
    it('POST /api/v1/auth/signup should register user and return token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'integration@test.com',
          fullName: 'Integration Tester',
          password: 'Password123!',
        })
        .expect(201);

      expect(response.body.user.email).toBe('integration@test.com');
      expect(response.body.tokens.accessToken).toBe(mockToken);
    });

    it('POST /api/v1/auth/login should authenticate user and return access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'integration@test.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.user.id).toBe('user-e2e-1');
      expect(response.body.tokens.accessToken).toBe(mockToken);
    });

    it('GET /api/v1/auth/me should return authenticated user profile when Bearer token provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.id).toBe('user-e2e-1');
      expect(response.body.email).toBe('integration@test.com');
    });
  });

  describe('2. Unauthenticated Guard Protection', () => {
    it('GET /api/v1/auth/me without authorization header should return 403 or 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(403);
    });

    it('GET /api/v1/portfolio without authorization header should be blocked', async () => {
      await request(app.getHttpServer()).get('/api/v1/portfolio').expect(403);
    });
  });

  describe('3. Portfolio State Persistence Integration', () => {
    it('POST /api/v1/portfolio/transactions should record BUY transaction and update GET /api/v1/portfolio', async () => {
      // 1. Post transaction
      const txResponse = await request(app.getHttpServer())
        .post('/api/v1/portfolio/transactions')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          symbol: 'TCS.NS',
          type: 'BUY',
          quantity: 10,
          price: 3500,
        })
        .expect(201);

      expect(txResponse.body.message).toBe('Transaction executed successfully');
      expect(txResponse.body.transaction.quantity).toBe(10);

      // 2. Fetch portfolio and verify updated holding state
      const portResponse = await request(app.getHttpServer())
        .get('/api/v1/portfolio')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(portResponse.body.holdings.length).toBe(1);
      expect(portResponse.body.holdings[0].stock.symbol).toBe('TCS.NS');
      expect(portResponse.body.holdings[0].quantity).toBe(10);
      expect(portResponse.body.totalValue).toBe(35000);
    });
  });
});
