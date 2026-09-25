import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import type { Env } from '@/config/env';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';
import type {
  CurrentSession,
  GraceSession,
  StoredSession,
} from './session.type';

describe('SessionService', () => {
  let sessionService: SessionService;
  let sessionRepository: SessionRepository;
  let configService: ConfigService<Env>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SessionRepository,
          useValue: {
            createCurrentSession: jest.fn(),
            getSession: jest.fn(),
            rotateSession: jest.fn(),
            revokeSession: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    sessionService = module.get(SessionService);
    sessionRepository = module.get(SessionRepository);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is defined', () => {
    expect(sessionService).toBeDefined();
  });

  describe('saveCurrentSession', () => {
    const userId = 'user-1';

    it('建立 Current Session，僅將 Session ID 的 SHA-256 hash 傳給 Repository', async () => {
      // Arrange
      const now = new Date('2026-09-23T04:05:06.789Z');
      const nowMs = now.getTime();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const getOrThrowSpy = jest
        .spyOn(configService, 'getOrThrow')
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(15)
        .mockReturnValueOnce(5);
      const createCurrentSessionSpy = jest
        .spyOn(sessionRepository, 'createCurrentSession')
        .mockResolvedValue(undefined);

      // Act
      const sessionId = await sessionService.saveCurrentSession(userId);

      // Assert
      expect(sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const sessionIdHash = createHash('sha256')
        .update(sessionId)
        .digest('hex');
      const repositoryCall = createCurrentSessionSpy.mock.calls[0];
      if (!repositoryCall) {
        throw new Error('createCurrentSession should be called');
      }
      const [receivedSessionIdHash, savedSession, maxDevices] = repositoryCall;

      expect(receivedSessionIdHash).toBe(sessionIdHash);
      expect(savedSession.familyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(savedSession).toEqual({
        userId,
        familyId: savedSession.familyId,
        state: 'current',
        generation: 1,
        familyCreatedAtMs: nowMs,
        tokenIssuedAtMs: nowMs,
        rotateAtMs: nowMs + 15 * 60 * 1000,
        expiresAtMs: nowMs + 7 * 24 * 60 * 60 * 1000,
      });
      expect(maxDevices).toBe(5);
      expect(getOrThrowSpy).toHaveBeenCalledTimes(3);
      expect(getOrThrowSpy).toHaveBeenNthCalledWith(1, 'SESSION_EXPIRE_DAY', {
        infer: true,
      });
      expect(getOrThrowSpy).toHaveBeenNthCalledWith(
        2,
        'SESSION_ROTATE_MINUTE',
        { infer: true },
      );
      expect(getOrThrowSpy).toHaveBeenNthCalledWith(3, 'MAX_DEVICE', {
        infer: true,
      });
    });

    it('Repository 儲存失敗時將錯誤往上拋出', async () => {
      // Arrange
      jest
        .spyOn(configService, 'getOrThrow')
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(15)
        .mockReturnValueOnce(5);
      const repositoryError = new Error('Redis write failed');
      const createCurrentSessionSpy = jest
        .spyOn(sessionRepository, 'createCurrentSession')
        .mockRejectedValue(repositoryError);

      // Act
      const action = sessionService.saveCurrentSession(userId);

      // Assert
      await expect(action).rejects.toBe(repositoryError);
      expect(createCurrentSessionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('authenticateSession', () => {
    const sessionId = 'session-token';
    const sessionIdHash = createHash('sha256').update(sessionId).digest('hex');
    const now = new Date('2026-09-23T04:05:06.789Z');
    const nowMs = now.getTime();
    const currentSession: CurrentSession = {
      userId: 'user-1',
      familyId: 'family-1',
      state: 'current',
      generation: 1,
      familyCreatedAtMs: nowMs - 60_000,
      tokenIssuedAtMs: nowMs - 60_000,
      rotateAtMs: nowMs,
      expiresAtMs: nowMs + 24 * 60 * 60 * 1000,
    };
    const graceSession: GraceSession = {
      userId: currentSession.userId,
      familyId: currentSession.familyId,
      state: 'grace',
      generation: currentSession.generation,
      familyCreatedAtMs: currentSession.familyCreatedAtMs,
      tokenIssuedAtMs: currentSession.tokenIssuedAtMs,
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    it('查無 Session 時回傳 null，且不嘗試輪轉', async () => {
      // Arrange
      const getSessionSpy = jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(null);
      const rotateSessionSpy = jest.spyOn(sessionRepository, 'rotateSession');
      const getOrThrowSpy = jest.spyOn(configService, 'getOrThrow');

      // Act
      const result = await sessionService.authenticateSession(sessionId);

      // Assert
      expect(result).toBeNull();
      expect(getSessionSpy).toHaveBeenCalledWith(sessionIdHash);
      expect(rotateSessionSpy).not.toHaveBeenCalled();
      expect(getOrThrowSpy).not.toHaveBeenCalled();
    });

    it('Grace Session 僅回傳 userId，不再次輪轉', async () => {
      // Arrange
      jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(graceSession);
      const rotateSessionSpy = jest.spyOn(sessionRepository, 'rotateSession');
      const getOrThrowSpy = jest.spyOn(configService, 'getOrThrow');

      // Act
      const result = await sessionService.authenticateSession(sessionId);

      // Assert
      expect(result).toEqual({ userId: graceSession.userId });
      expect(rotateSessionSpy).not.toHaveBeenCalled();
      expect(getOrThrowSpy).not.toHaveBeenCalled();
    });

    it('Current Session 尚未到輪轉時間時直接通過', async () => {
      // Arrange
      jest.spyOn(sessionRepository, 'getSession').mockResolvedValue({
        ...currentSession,
        rotateAtMs: nowMs + 1,
      });
      const rotateSessionSpy = jest.spyOn(sessionRepository, 'rotateSession');
      const getOrThrowSpy = jest.spyOn(configService, 'getOrThrow');

      // Act
      const result = await sessionService.authenticateSession(sessionId);

      // Assert
      expect(result).toEqual({ userId: currentSession.userId });
      expect(rotateSessionSpy).not.toHaveBeenCalled();
      expect(getOrThrowSpy).not.toHaveBeenCalled();
    });

    it('到達輪轉時間且成功輪轉時，回傳新 Session ID 並傳入正確的 hash 與期限', async () => {
      // Arrange
      jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(currentSession);
      const getOrThrowSpy = jest
        .spyOn(configService, 'getOrThrow')
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(15);
      const rotateSessionSpy = jest
        .spyOn(sessionRepository, 'rotateSession')
        .mockResolvedValue({
          status: 'ROTATED',
          userId: currentSession.userId,
        });

      // Act
      const result = await sessionService.authenticateSession(sessionId);

      // Assert
      expect(result?.userId).toBe(currentSession.userId);
      const rotatedSessionId = result?.rotatedSessionId;
      expect(rotatedSessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      if (!rotatedSessionId) {
        throw new Error('rotatedSessionId should be returned');
      }
      const newSessionIdHash = createHash('sha256')
        .update(rotatedSessionId)
        .digest('hex');
      expect(rotateSessionSpy).toHaveBeenCalledTimes(1);
      expect(rotateSessionSpy).toHaveBeenCalledWith({
        oldSessionIdHash: sessionIdHash,
        newSessionIdHash,
        userId: currentSession.userId,
        nowMs,
        newRotateAtMs: nowMs + 15 * 60 * 1000,
        newExpiresAtMs: nowMs + 7 * 24 * 60 * 60 * 1000,
        graceUntilMs: nowMs + 20 * 1000,
      });
      expect(getOrThrowSpy).toHaveBeenNthCalledWith(1, 'SESSION_EXPIRE_DAY', {
        infer: true,
      });
      expect(getOrThrowSpy).toHaveBeenNthCalledWith(
        2,
        'SESSION_ROTATE_MINUTE',
        { infer: true },
      );
    });

    it('輪轉時 Session 已不存在則回傳 null', async () => {
      // Arrange
      jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(currentSession);
      jest
        .spyOn(configService, 'getOrThrow')
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(15);
      const rotateSessionSpy = jest
        .spyOn(sessionRepository, 'rotateSession')
        .mockResolvedValue({ status: 'MISSING' });

      // Act
      const result = await sessionService.authenticateSession(sessionId);

      // Assert
      expect(result).toBeNull();
      expect(rotateSessionSpy).toHaveBeenCalledTimes(1);
    });

    it.each(['CURRENT', 'GRACE'] as const)(
      '輪轉競爭時 Repository 回傳 %s，僅回傳 Repository 的 userId',
      async (status) => {
        // Arrange
        jest
          .spyOn(sessionRepository, 'getSession')
          .mockResolvedValue(currentSession);
        jest
          .spyOn(configService, 'getOrThrow')
          .mockReturnValueOnce(7)
          .mockReturnValueOnce(15);
        const rotateSessionSpy = jest
          .spyOn(sessionRepository, 'rotateSession')
          .mockResolvedValue({ status, userId: 'repository-user' });

        // Act
        const result = await sessionService.authenticateSession(sessionId);

        // Assert
        expect(result).toEqual({ userId: 'repository-user' });
        expect(rotateSessionSpy).toHaveBeenCalledTimes(1);
      },
    );

    it('Repository 輪轉失敗時將錯誤往上拋出', async () => {
      // Arrange
      jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(currentSession);
      jest
        .spyOn(configService, 'getOrThrow')
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(15);
      const repositoryError = new Error('Redis rotation failed');
      jest
        .spyOn(sessionRepository, 'rotateSession')
        .mockRejectedValue(repositoryError);

      // Act
      const action = sessionService.authenticateSession(sessionId);

      // Assert
      await expect(action).rejects.toBe(repositoryError);
    });
  });

  describe('authenticateSocketSession', () => {
    const sessionId = 'socket-session-token';
    const sessionIdHash = createHash('sha256').update(sessionId).digest('hex');
    const nowMs = Date.now();
    const currentSession: CurrentSession = {
      userId: 'user-1',
      familyId: 'family-1',
      state: 'current',
      generation: 1,
      familyCreatedAtMs: nowMs - 60_000,
      tokenIssuedAtMs: nowMs - 60_000,
      rotateAtMs: nowMs - 1,
      expiresAtMs: nowMs + 24 * 60 * 60 * 1000,
    };
    const graceSession: GraceSession = {
      userId: 'user-2',
      familyId: 'family-2',
      state: 'grace',
      generation: 2,
      familyCreatedAtMs: nowMs - 60_000,
      tokenIssuedAtMs: nowMs - 30_000,
    };

    it.each([
      ['Current', currentSession],
      ['Grace', graceSession],
    ] as const)(
      '有效的 %s Session 回傳 userId，且不執行輪轉',
      async (_state, session) => {
        // Arrange
        const getSessionSpy = jest
          .spyOn(sessionRepository, 'getSession')
          .mockResolvedValue(session);
        const rotateSessionSpy = jest.spyOn(sessionRepository, 'rotateSession');

        // Act
        const result =
          await sessionService.authenticateSocketSession(sessionId);

        // Assert
        expect(result).toBe(session.userId);
        expect(getSessionSpy).toHaveBeenCalledWith(sessionIdHash);
        expect(rotateSessionSpy).not.toHaveBeenCalled();
      },
    );

    it('查無 Session 時回傳 null，且不執行輪轉', async () => {
      // Arrange
      const getSessionSpy = jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(null);
      const rotateSessionSpy = jest.spyOn(sessionRepository, 'rotateSession');

      // Act
      const result = await sessionService.authenticateSocketSession(sessionId);

      // Assert
      expect(result).toBeNull();
      expect(getSessionSpy).toHaveBeenCalledWith(sessionIdHash);
      expect(rotateSessionSpy).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    const sessionId = 'session-token';
    const sessionIdHash = createHash('sha256').update(sessionId).digest('hex');

    it('查無 Session 時不呼叫 Repository 撤銷', async () => {
      // Arrange
      const getSessionSpy = jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(null);
      const revokeSessionSpy = jest.spyOn(sessionRepository, 'revokeSession');

      // Act
      await sessionService.revokeSession(sessionId);

      // Assert
      expect(getSessionSpy).toHaveBeenCalledWith(sessionIdHash);
      expect(revokeSessionSpy).not.toHaveBeenCalled();
    });

    it('查到 Session 時依 userId 與 hash 撤銷', async () => {
      // Arrange
      const session: GraceSession = {
        userId: 'user-1',
        familyId: 'family-1',
        state: 'grace',
        generation: 1,
        familyCreatedAtMs: 1,
        tokenIssuedAtMs: 1,
      };
      jest.spyOn(sessionRepository, 'getSession').mockResolvedValue(session);
      const revokeSessionSpy = jest.spyOn(sessionRepository, 'revokeSession');

      // Act
      await sessionService.revokeSession(sessionId);

      // Assert
      expect(revokeSessionSpy).toHaveBeenCalledTimes(1);
      expect(revokeSessionSpy).toHaveBeenCalledWith(
        session.userId,
        sessionIdHash,
      );
    });
  });

  describe('getSession', () => {
    const sessionId = 'session-token';
    const sessionIdHash = createHash('sha256').update(sessionId).digest('hex');

    it.each<StoredSession | null>([
      {
        userId: 'user-1',
        familyId: 'family-1',
        state: 'grace',
        generation: 1,
        familyCreatedAtMs: 1,
        tokenIssuedAtMs: 1,
      },
      null,
    ])('回傳 Repository 查詢結果 %#', async (session) => {
      // Arrange
      const getSessionSpy = jest
        .spyOn(sessionRepository, 'getSession')
        .mockResolvedValue(session);

      // Act
      const result = await sessionService.getSession(sessionId);

      // Assert
      expect(result).toEqual(session);
      expect(getSessionSpy).toHaveBeenCalledWith(sessionIdHash);
    });
  });

  describe('delete', () => {
    const sessionId = 'session-token';
    const sessionIdHash = createHash('sha256').update(sessionId).digest('hex');

    it.each([true, false])('回傳 Repository 刪除結果 %s', async (deleted) => {
      // Arrange
      const deleteSpy = jest
        .spyOn(sessionRepository, 'delete')
        .mockResolvedValue(deleted);

      // Act
      const result = await sessionService.delete(sessionId);

      // Assert
      expect(result).toBe(deleted);
      expect(deleteSpy).toHaveBeenCalledWith(sessionIdHash);
    });
  });
});
