local sessionKey = KEYS[1]
local userSessionsKey = KEYS[2]
local sessionIdHash = ARGV[1]

local isDelete = redis.call('DEL', sessionKey)
redis.call('ZREM', userSessionsKey, sessionIdHash)
if isDelete == 1 then
  return 'REVOKED'
end

return 'MISSING'