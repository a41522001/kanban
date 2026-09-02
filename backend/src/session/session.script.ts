import { defineScript } from 'redis';
type CreateCurrentSessionScriptInput = {
  currentSessionKey: string;
  userSessionsKey: string;
  sessionIdHash: string;
  nowMs: number;
  expiresAtMs: number;
  maxDevices: number;
  sessionKeyPrefix: string;
  userId: string;
  familyId: string;
  generation: number;
  familyCreatedAtMs: number;
  tokenIssuedAtMs: number;
  rotateAtMs: number;
};
type RotateSessionScriptInput = {
  oldSessionKey: string;
  newSessionKey: string;
  userSessionsKey: string;
  oldSessionIdHash: string;
  newSessionIdHash: string;
  nowMs: number;
  newRotateAtMs: number;
  newExpiresAtMs: number;
  graceUntilMs: number;
};
type RevokeSessionScriptInput = {
  sessionKey: string;
  userSessionsKey: string;
  sessionIdHash: string;
};
type RawRotateSessionReply =
  ['MISSING'] | ['GRACE', string] | ['CURRENT', string] | ['ROTATED', string];

export type RotateSessionReply =
  | { status: 'MISSING' }
  | { status: 'GRACE'; userId: string }
  | { status: 'CURRENT'; userId: string }
  | { status: 'ROTATED'; userId: string };

const CREATE_CURRENT_SESSION_SCRIPT = defineScript({
  SCRIPT: `
    -- KEYS[1]: 新 Current Session Hash key
    -- KEYS[2]: 使用者 Session ZSET key

    -- ARGV[1]: sessionIdHash
    -- ARGV[2]: nowMs
    -- ARGV[3]: expiresAtMs
    -- ARGV[4]: maxDevices
    -- ARGV[5]: Session key prefix
    -- ARGV[6]: userId
    -- ARGV[7]: familyId
    -- ARGV[8]: generation
    -- ARGV[9]: familyCreatedAtMs
    -- ARGV[10]: tokenIssuedAtMs
    -- ARGV[11]: rotateAtMs

    local currentSessionKey = KEYS[1]
    local zSetKey = KEYS[2]

    local sessionIdHash = ARGV[1]
    local nowMs = tonumber(ARGV[2])
    local expiresAtMs = tonumber(ARGV[3])
    local maxDevices = tonumber(ARGV[4])
    local sessionKeyPrefix = ARGV[5]

    if not nowMs then
      return redis.error_reply('nowMs 必須為數字')
    end

    if not expiresAtMs then
      return redis.error_reply('expiresAtMs 必須為數字')
    end

    if not maxDevices or maxDevices < 1 then
      return redis.error_reply('maxDevices 必須大於0')
    end

    -- 第一階段：
    -- 清除 ZSET 中已經過期的 Session 索引。
    redis.call(
      'ZREMRANGEBYSCORE',
      zSetKey,
      '-inf',
      nowMs
    )

    -- 第二階段：
    -- 建立新的 Current Session Hash。
    redis.call(
      'HSET',
      currentSessionKey,
      'userId', ARGV[6],
      'familyId', ARGV[7],
      'state', 'current',
      'generation', ARGV[8],
      'familyCreatedAtMs', ARGV[9],
      'tokenIssuedAtMs', ARGV[10],
      'rotateAtMs', ARGV[11],
      'expiresAtMs', ARGV[3]
    )

    -- 設定 Current Session Hash 的絕對到期時間。
    redis.call(
      'PEXPIREAT',
      currentSessionKey,
      expiresAtMs
    )

    -- 第三階段：
    -- 將新 Session 加入使用者的 ZSET。
    redis.call(
      'ZADD',
      zSetKey,
      expiresAtMs,
      sessionIdHash
    )

    -- 第四階段：
    -- 計算超過裝置上限的數量。
    local memberCount = redis.call('ZCARD', zSetKey)
    local overflowCount = memberCount - maxDevices
    local evictedSessionIdHashes = {}

    if overflowCount > 0 then
      -- 由最早到期的 Session 開始尋找。
      local sessionIdHashes = redis.call(
        'ZRANGE',
        zSetKey,
        0,
        -1
      )

      for _, currentSessionIdHash in ipairs(sessionIdHashes) do
        if #evictedSessionIdHashes >= overflowCount then
          break
        end

        -- 不淘汰這次才建立的新 Session。
        if currentSessionIdHash ~= sessionIdHash then
          local evictedCurrentKey =
            sessionKeyPrefix .. currentSessionIdHash

          local previousSessionIdHash = redis.call(
            'HGET',
            evictedCurrentKey,
            'previousSessionIdHash'
          )

          -- 刪除被淘汰的 Current Session。
          redis.call('DEL', evictedCurrentKey)

          -- 刪除 Current 對應的 Previous Grace Session。
          if previousSessionIdHash then
            redis.call(
              'DEL',
              sessionKeyPrefix .. previousSessionIdHash
            )
          end

          -- 刪除 ZSET member。
          redis.call(
            'ZREM',
            zSetKey,
            currentSessionIdHash
          )

          table.insert(
            evictedSessionIdHashes,
            currentSessionIdHash
          )
        end
      end
    end

    -- 第五階段：
    -- 讓 ZSET 的 TTL 等於目前最晚到期的 Current Session。
    --
    -- 使用最大 score，而不是直接使用新 Session 的 expiresAtMs，
    -- 可以避免併發或設定變更導致 ZSET TTL 被縮短。
    local newestSession = redis.call(
      'ZRANGE',
      zSetKey,
      -1,
      -1,
      'WITHSCORES'
    )

    if #newestSession >= 2 then
      redis.call(
        'PEXPIREAT',
        zSetKey,
        newestSession[2]
      )
    end

    -- 回傳被淘汰的 Session hash，方便除錯或記錄 log。
    return evictedSessionIdHashes
  `,
  NUMBER_OF_KEYS: 2,

  parseCommand(parser, input: CreateCurrentSessionScriptInput) {
    parser.pushKey(input.currentSessionKey);
    parser.pushKey(input.userSessionsKey);

    parser.push(
      input.sessionIdHash,
      input.nowMs.toString(),
      input.expiresAtMs.toString(),
      input.maxDevices.toString(),
      input.sessionKeyPrefix,
      input.userId,
      input.familyId,
      input.generation.toString(),
      input.familyCreatedAtMs.toString(),
      input.tokenIssuedAtMs.toString(),
      input.rotateAtMs.toString(),
    );
  },

  transformReply(reply: string[]): string[] {
    return reply;
  },
});

const ROTATE_SESSION_SCRIPT = defineScript({
  SCRIPT: `
    -- KEYS[1]: 舊 Session Hash key
    -- KEYS[2]: 新 Current Session Hash key
    -- KEYS[3]: 使用者 Session ZSET key

    -- ARGV[1]: 舊 sessionIdHash
    -- ARGV[2]: 新 sessionIdHash
    -- ARGV[3]: 目前的 Unix epoch 絕對毫秒
    -- ARGV[4]: 新 Current Session 的 rotateAtMs
    -- ARGV[5]: 新 Current Session 的 expiresAtMs
    -- ARGV[6]: 舊 Session 轉成 Grace 後的絕對過期毫秒

    local oldSessionKey = KEYS[1]
    local newSessionKey = KEYS[2]
    local userSessionsKey = KEYS[3]

    local oldSessionIdHash = ARGV[1]
    local newSessionIdHash = ARGV[2]
    local nowTimeMilliseconds = tonumber(ARGV[3])
    local newRotateAtMs = tonumber(ARGV[4])
    local newExpiresAtMs = tonumber(ARGV[5])
    local graceUntilMs = tonumber(ARGV[6])

    if redis.call('EXISTS', oldSessionKey) == 0 then
      return { 'MISSING' }
    end

    local sessionValues = redis.call(
      'HMGET',
      oldSessionKey,
      'state',
      'userId',
      'familyId',
      'generation',
      'familyCreatedAtMs',
      'rotateAtMs'
    )

    local state = sessionValues[1]
    local userId = sessionValues[2]
    local familyId = sessionValues[3]
    local generation = tonumber(sessionValues[4])
    local familyCreatedAtMs = tonumber(sessionValues[5])
    local rotateAtMs = tonumber(sessionValues[6])

    if state == 'grace' then
      return { 'GRACE', userId }
    end

    if state == 'current' then
      if nowTimeMilliseconds < rotateAtMs then
        return { 'CURRENT', userId }
      end

      redis.call(
        'HSET',
        newSessionKey,
        'userId', userId,
        'familyId', familyId,
        'state', 'current',
        'generation', generation + 1,
        'familyCreatedAtMs', familyCreatedAtMs,
        'tokenIssuedAtMs', nowTimeMilliseconds,
        'rotateAtMs', newRotateAtMs,
        'expiresAtMs', newExpiresAtMs,
        'previousSessionIdHash', oldSessionIdHash
      )

      redis.call(
        'PEXPIREAT',
        newSessionKey,
        newExpiresAtMs
      )

      redis.call(
        'HSET',
        oldSessionKey,
        'state', 'grace'
      )

      redis.call(
        'PEXPIREAT',
        oldSessionKey,
        graceUntilMs
      )

      redis.call(
        'ZREM',
        userSessionsKey,
        oldSessionIdHash
      )

      redis.call(
        'ZADD',
        userSessionsKey,
        newExpiresAtMs,
        newSessionIdHash
      )

      local newestSession = redis.call(
        'ZRANGE',
        userSessionsKey,
        -1,
        -1,
        'WITHSCORES'
      )

      if #newestSession >= 2 then
        redis.call(
          'PEXPIREAT',
          userSessionsKey,
          newestSession[2]
        )
      end

      return { 'ROTATED', userId }
    end

    return { 'MISSING' }
  `,
  NUMBER_OF_KEYS: 3,

  parseCommand(parser, input: RotateSessionScriptInput) {
    parser.pushKey(input.oldSessionKey);
    parser.pushKey(input.newSessionKey);
    parser.pushKey(input.userSessionsKey);

    parser.push(
      input.oldSessionIdHash,
      input.newSessionIdHash,
      input.nowMs.toString(),
      input.newRotateAtMs.toString(),
      input.newExpiresAtMs.toString(),
      input.graceUntilMs.toString(),
    );
  },

  transformReply(reply: string[]): RotateSessionReply {
    const [status, userId] = reply as RawRotateSessionReply;

    switch (status) {
      case 'MISSING':
        return { status };

      case 'GRACE':
        return { status, userId };

      case 'CURRENT':
        return { status, userId };

      case 'ROTATED':
        return { status, userId };
    }
  },
});

const REVOKE_SESSION_SCRIPT = defineScript({
  SCRIPT: `
    local sessionKey = KEYS[1]
    local userSessionsKey = KEYS[2]
    local sessionIdHash = ARGV[1]

    local isDelete = redis.call('DEL', sessionKey)
    redis.call('ZREM', userSessionsKey, sessionIdHash)
    if isDelete == 1 then
      return 'REVOKED'
    end

    return 'MISSING'
  `,
  NUMBER_OF_KEYS: 2,
  parseCommand(parser, input: RevokeSessionScriptInput) {
    parser.pushKey(input.sessionKey);
    parser.pushKey(input.userSessionsKey);

    parser.push(input.sessionIdHash);
  },
  transformReply(reply: string): string {
    return reply;
  },
});
export const SESSION_SCRIPTS = {
  createCurrentSession: CREATE_CURRENT_SESSION_SCRIPT,
  rotateSession: ROTATE_SESSION_SCRIPT,
  revokeSession: REVOKE_SESSION_SCRIPT,
};

export type SessionScripts = typeof SESSION_SCRIPTS;
