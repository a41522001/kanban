import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RateLimitService } from './rateLimit.service';
import { RedisService } from './redis.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let client: {
    rateLimitLogin: jest.Mock;
    rateLimitSignup: jest.Mock;
    rateLimitLoginRefund: jest.Mock;
  };
  const email = 'alice@example.com';
  const ip = '203.0.113.5';
  // Distinct values per field, so swapping two of them fails the payload assertions.
  const rateLimit = {
    loginEmailIp: { max: 5, windowSeconds: 900 },
    loginIp: { max: 50, windowSeconds: 901 },
    loginEmail: { max: 100, windowSeconds: 3600 },
    signupIp: { max: 20, windowSeconds: 3601 },
  };

  beforeEach(async () => {
    client = {
      rateLimitLogin: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      }),
      rateLimitSignup: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      }),
      rateLimitLoginRefund: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: RedisService,
          useValue: { getClient: jest.fn().mockReturnValue(client) },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'auth.rateLimit' ? rateLimit : undefined,
            ),
          },
        },
      ],
    }).compile();
    service = module.get(RateLimitService);
  });

  describe('hitLogin', () => {
    it('三個 key 各自帶上 config 的上限與視窗', async () => {
      // Act
      await service.hitLogin(email, ip);

      // Assert
      expect(client.rateLimitLogin).toHaveBeenCalledWith({
        emailIpKey: `rateLimit:login:emailIp:${email}:${ip}`,
        emailIpLimit: 5,
        emailIpWindowSeconds: 900,
        ipKey: `rateLimit:login:ip:${ip}`,
        ipLimit: 50,
        ipWindowSeconds: 901,
        emailKey: `rateLimit:login:email:${email}`,
        emailLimit: 100,
        emailWindowSeconds: 3600,
      });
    });

    it('通過時回傳 allowed 與 0 秒', async () => {
      // Act
      const result = await service.hitLogin(email, ip);

      // Assert
      expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    });

    it.each([
      [899_570, 900],
      [1, 1],
      [1_000, 1],
      [1_001, 2],
    ])(
      '被擋時剩餘 %d 毫秒無條件進位成 %d 秒',
      async (retryAfterMs, expectedSeconds) => {
        // Arrange
        client.rateLimitLogin.mockResolvedValue({
          allowed: false,
          retryAfterMs,
        });

        // Act
        const result = await service.hitLogin(email, ip);

        // Assert
        // Rounding up guarantees the key has expired when the client's countdown ends.
        expect(result).toEqual({
          allowed: false,
          retryAfterSeconds: expectedSeconds,
        });
      },
    );

    it('Redis 錯誤直接丟出（fail-closed）', async () => {
      // Arrange
      const error = new Error('Redis unavailable');
      client.rateLimitLogin.mockRejectedValue(error);

      // Act
      const result = service.hitLogin(email, ip);

      // Assert
      await expect(result).rejects.toBe(error);
    });
  });

  describe('hitSignup', () => {
    it('只用 IP key，帶上 signup 的上限與視窗', async () => {
      // Act
      await service.hitSignup(ip);

      // Assert
      expect(client.rateLimitSignup).toHaveBeenCalledWith({
        ipKey: `rateLimit:signup:ip:${ip}`,
        ipLimit: 20,
        ipWindowSeconds: 3601,
      });
    });

    it('被擋時毫秒無條件進位成秒', async () => {
      // Arrange
      client.rateLimitSignup.mockResolvedValue({
        allowed: false,
        retryAfterMs: 3_599_001,
      });

      // Act
      const result = await service.hitSignup(ip);

      // Assert
      expect(result).toEqual({ allowed: false, retryAfterSeconds: 3600 });
    });
  });

  describe('refundLogin', () => {
    it('退回的三個 key 和 hitLogin 計數的 key 相同', async () => {
      // Arrange
      await service.hitLogin(email, ip);
      const [hitPayload] = client.rateLimitLogin.mock.calls[0] as [
        { emailIpKey: string; ipKey: string; emailKey: string },
      ];

      // Act
      await service.refundLogin(email, ip);

      // Assert
      expect(client.rateLimitLoginRefund).toHaveBeenCalledWith({
        emailIpKey: hitPayload.emailIpKey,
        ipKey: hitPayload.ipKey,
        emailKey: hitPayload.emailKey,
      });
    });
  });
});
