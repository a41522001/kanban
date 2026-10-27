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
  'tokenIssuedAtMs',
  'rotateAtMs',
  'expiresAtMs',
  'previousSessionIdHash'
)
local state = sessionValues[1]
local userId = sessionValues[2]
local familyId = sessionValues[3]
local generation = tonumber(sessionValues[4])
local familyCreatedAtMs = tonumber(sessionValues[5])
local tokenIssuedAtMs = tonumber(sessionValues[6])
local rotateAtMs = tonumber(sessionValues[7])
local expiresAtMs = tonumber(sessionValues[8])
local previousSessionIdHash = sessionValues[9]

if state == 'grace' then
  return { 'GRACE', userId }
end

if state == 'current' then
  -- 比較 rotateAtMs
  if nowTimeMilliseconds < rotateAtMs then
    return { 'CURRENT', userId }
  end

  -- 建立新的 Current Session Hash
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
  -- 設定 Current Session Hash 的絕對到期時間。
  redis.call(
    'PEXPIREAT',
    newSessionKey,
    newExpiresAtMs
  )

  -- 更改舊 Session 的狀態
  redis.call(
    'HSET',
    oldSessionKey,
    'state', 'grace'
  )
  -- 更改舊 Session 的到期時間
  redis.call(
    'PEXPIREAT',
    oldSessionKey,
    graceUntilMs
  )

  -- 清除 Zset
  redis.call(
    'ZREM',
    userSessionsKey,
    oldSessionIdHash
  )

  -- 新增Zset
  redis.call(
    'ZADD',
    userSessionsKey,
    newExpiresAtMs,
    newSessionIdHash
  )

  -- 延長Zset到期時間
  redis.call(
    'PEXPIREAT',
    userSessionsKey,
    newExpiresAtMs
  )
  
  return { 'ROTATED', userId }
end
