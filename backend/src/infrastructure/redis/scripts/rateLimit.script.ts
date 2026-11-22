import { defineScript } from 'redis';
type RateLimitLoginScriptInput = {
  emailIpKey: string;
  emailIpLimit: number;
  emailIpWindowSeconds: number;
  ipKey: string;
  ipLimit: number;
  ipWindowSeconds: number;
  emailKey: string;
  emailLimit: number;
  emailWindowSeconds: number;
};

type RateLimitSignupScriptInput = {
  ipKey: string;
  ipLimit: number;
  ipWindowSeconds: number;
};

type RateLimitRefundScriptInput = {
  emailIpKey: string;
  ipKey: string;
  emailKey: string;
};
export const RATE_LIMIT_LOGIN_SCRIPT = defineScript({
  SCRIPT: `
    local emailIpKey = KEYS[1]
    local ipKey = KEYS[2]
    local emailKey = KEYS[3]

    local emailIpLimit = tonumber(ARGV[1])
    local emailIpWindowSeconds = tonumber(ARGV[2])
    local ipLimit = tonumber(ARGV[3])
    local ipWindowSeconds = tonumber(ARGV[4])
    local emailLimit = tonumber(ARGV[5])
    local emailWindowSeconds = tonumber(ARGV[6])

    local emailIpCount = tonumber(redis.call('GET', emailIpKey) or '0') 
    local ipCount = tonumber(redis.call('GET', ipKey) or '0') 
    local emailCount = tonumber(redis.call('GET', emailKey) or '0')

    local blocked = false
    local retryAfterMs = 0

    if emailIpCount >= emailIpLimit then
      blocked = true
      retryAfterMs = math.max(retryAfterMs, redis.call('PTTL', emailIpKey))
    end

    if ipCount >= ipLimit then
      blocked = true
      retryAfterMs = math.max(retryAfterMs, redis.call('PTTL', ipKey))
    end

    if emailCount >= emailLimit then
      blocked = true
      retryAfterMs = math.max(retryAfterMs, redis.call('PTTL', emailKey))
    end

    if blocked then
      return math.max(retryAfterMs, 1)
    end

    if redis.call('INCR', emailIpKey) == 1 then
      redis.call('EXPIRE', emailIpKey, emailIpWindowSeconds)
    end

    if redis.call('INCR', ipKey) == 1 then
      redis.call('EXPIRE', ipKey, ipWindowSeconds)
    end

    if redis.call('INCR', emailKey) == 1 then
      redis.call('EXPIRE', emailKey, emailWindowSeconds)
    end

    return 0
  `,
  NUMBER_OF_KEYS: 3,
  parseCommand(parser, input: RateLimitLoginScriptInput) {
    parser.pushKey(input.emailIpKey);
    parser.pushKey(input.ipKey);
    parser.pushKey(input.emailKey);

    parser.push(input.emailIpLimit.toString());
    parser.push(input.emailIpWindowSeconds.toString());
    parser.push(input.ipLimit.toString());
    parser.push(input.ipWindowSeconds.toString());
    parser.push(input.emailLimit.toString());
    parser.push(input.emailWindowSeconds.toString());
  },

  transformReply(reply: number) {
    return { allowed: reply === 0, retryAfterMs: reply };
  },
});

export const RATE_LIMIT_SIGNUP_SCRIPT = defineScript({
  SCRIPT: `
    local ipKey = KEYS[1]

    local ipLimit = tonumber(ARGV[1])
    local ipWindowSeconds = tonumber(ARGV[2])
    local ipCount = tonumber(redis.call('GET', ipKey) or '0')
    
    if ipCount >= ipLimit then
      return math.max(redis.call('PTTL', ipKey), 1)
    end

    if redis.call('INCR', ipKey) == 1 then
      redis.call('EXPIRE', ipKey, ipWindowSeconds)
    end

    return 0
  `,
  NUMBER_OF_KEYS: 1,
  parseCommand(parser, input: RateLimitSignupScriptInput) {
    parser.pushKey(input.ipKey);

    parser.push(input.ipLimit.toString());
    parser.push(input.ipWindowSeconds.toString());
  },

  transformReply(reply: number) {
    return { allowed: reply === 0, retryAfterMs: reply };
  },
});

export const RATE_LIMIT_LOGIN_REFUND_SCRIPT = defineScript({
  SCRIPT: `
    local emailIpKey = KEYS[1]
    local ipKey = KEYS[2]
    local emailKey = KEYS[3]

    redis.call('DEL', emailIpKey)

    if redis.call('EXISTS', emailKey) == 1 then
      redis.call('DECR', emailKey)
    end

    if redis.call('EXISTS', ipKey) == 1 then
      redis.call('DECR', ipKey)
    end

    return 0
  `,
  NUMBER_OF_KEYS: 3,
  parseCommand(parser, input: RateLimitRefundScriptInput) {
    parser.pushKey(input.emailIpKey);
    parser.pushKey(input.ipKey);
    parser.pushKey(input.emailKey);
  },

  transformReply(): void {
    return;
  },
});

export const RATE_LIMIT_SCRIPTS = {
  rateLimitLogin: RATE_LIMIT_LOGIN_SCRIPT,
  rateLimitSignup: RATE_LIMIT_SIGNUP_SCRIPT,
  rateLimitLoginRefund: RATE_LIMIT_LOGIN_REFUND_SCRIPT,
};
