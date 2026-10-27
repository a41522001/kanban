import { storedSessionSchema } from './session.schema';

describe('storedSessionSchema', () => {
  const baseSession = {
    userId: 'user-1',
    familyId: 'family-1',
    generation: '2',
    familyCreatedAtMs: '1000',
    tokenIssuedAtMs: '2000',
  };

  it('應將 Current Session 的 Redis 字串轉換成領域型別', () => {
    const result = storedSessionSchema.parse({
      ...baseSession,
      state: 'current',
      rotateAtMs: '3000',
      expiresAtMs: '4000',
      previousSessionIdHash: 'previous-session-hash',
    });

    expect(result).toEqual({
      userId: 'user-1',
      familyId: 'family-1',
      state: 'current',
      generation: 2,
      familyCreatedAtMs: 1000,
      tokenIssuedAtMs: 2000,
      rotateAtMs: 3000,
      expiresAtMs: 4000,
      previousSessionIdHash: 'previous-session-hash',
    });
  });

  it('應將 Grace Session 的 Redis 字串轉換成領域型別', () => {
    const result = storedSessionSchema.parse({
      ...baseSession,
      state: 'grace',
    });

    expect(result).toEqual({
      userId: 'user-1',
      familyId: 'family-1',
      state: 'grace',
      generation: 2,
      familyCreatedAtMs: 1000,
      tokenIssuedAtMs: 2000,
    });
  });

  it('應拒絕無法轉換的數字欄位', () => {
    const result = storedSessionSchema.safeParse({
      ...baseSession,
      state: 'current',
      rotateAtMs: 'not-a-number',
      expiresAtMs: '4000',
    });

    expect(result.success).toBe(false);
  });
});
