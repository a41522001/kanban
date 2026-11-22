import { defineScript } from 'redis';
type ReleaseLockScriptInput = { key: string; owner: string };
export const RELEASE_LOCK_SCRIPT = defineScript({
  SCRIPT: `
    local key = KEYS[1]
    local owner = ARGV[1]
    local token = redis.call('GET', key) 
    if owner == token then
      return redis.call('DEL', key)
    else 
      return 0
    end
  `,
  NUMBER_OF_KEYS: 1,
  parseCommand(parser, input: ReleaseLockScriptInput) {
    parser.pushKey(input.key);
    parser.push(input.owner);
  },

  transformReply(reply: number): boolean {
    return reply === 1;
  },
});

export const LOCK_SCRIPTS = { releaseLock: RELEASE_LOCK_SCRIPT };
