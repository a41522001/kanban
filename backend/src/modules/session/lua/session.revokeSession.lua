local sessionKey = KEYS[1]
local userSessionsKey = KEYS[2]
local sessionIdHash = ARGV[1]
local sessionKeyPrefix = ARGV[2]
local previousSessionIdHash = redis.call('HGET', sessionKey, 'previousSessionIdHash')
local isDelete = redis.call('DEL', sessionKey)

redis.call('ZREM', userSessionsKey, sessionIdHash)

if previousSessionIdHash then
  redis.call('DEL', sessionKeyPrefix .. previousSessionIdHash)
end

if isDelete == 1 then
  return 'REVOKED'
end

return 'MISSING'