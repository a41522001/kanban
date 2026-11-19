import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppConfig } from '@/config';
import { ConfigService } from '@nestjs/config';
import { redisKeys } from './redis.keys';
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
@Injectable()
export class RateLimitService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}
  async hitLogin(email: string, ip: string): Promise<RateLimitResult> {
    const client = this.redisService.getClient();
    const rateLimitConfig = this.configService.getOrThrow('auth.rateLimit', {
      infer: true,
    });
    const payload = {
      emailIpKey: redisKeys.rateLimitLoginEmailIp(email, ip),
      emailIpLimit: rateLimitConfig.loginEmailIp.max,
      emailIpWindowSeconds: rateLimitConfig.loginEmailIp.windowSeconds,
      ipKey: redisKeys.rateLimitLoginIp(ip),
      ipLimit: rateLimitConfig.loginIp.max,
      ipWindowSeconds: rateLimitConfig.loginIp.windowSeconds,
      emailKey: redisKeys.rateLimitLoginEmail(email),
      emailLimit: rateLimitConfig.loginEmail.max,
      emailWindowSeconds: rateLimitConfig.loginEmail.windowSeconds,
    };
    const result = await client.rateLimitLogin(payload);
    return {
      allowed: result.allowed,
      retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
    };
  }

  async hitSignup(ip: string): Promise<RateLimitResult> {
    const client = this.redisService.getClient();
    const rateLimitConfig = this.configService.getOrThrow('auth.rateLimit', {
      infer: true,
    });
    const payload = {
      ipKey: redisKeys.rateLimitSignupIp(ip),
      ipLimit: rateLimitConfig.signupIp.max,
      ipWindowSeconds: rateLimitConfig.signupIp.windowSeconds,
    };
    const result = await client.rateLimitSignup(payload);
    return {
      allowed: result.allowed,
      retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
    };
  }

  async refundLogin(email: string, ip: string): Promise<void> {
    const client = this.redisService.getClient();
    const payload = {
      emailIpKey: redisKeys.rateLimitLoginEmailIp(email, ip),
      ipKey: redisKeys.rateLimitLoginIp(ip),
      emailKey: redisKeys.rateLimitLoginEmail(email),
    };
    await client.rateLimitLoginRefund(payload);
  }
}
