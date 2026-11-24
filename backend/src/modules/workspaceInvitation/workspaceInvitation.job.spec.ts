import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { RedisLockService } from '@/infrastructure/redis/redisLock.service';
import { WorkspaceInvitationExpirationJob } from './workspaceInvitation.job';
import { WorkspaceInvitationService } from './workspaceInvitation.service';

describe('WorkspaceInvitationExpirationJob', () => {
  let job: WorkspaceInvitationExpirationJob;
  let expirePendingInvitations: jest.Mock<Promise<number>, [Date]>;
  let withLock: jest.Mock;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  /** Behaves like a real lock that was acquired: runs fn and wraps its result. */
  const runWhenAcquired = async (
    _key: string,
    _ttl: number,
    fn: () => Promise<unknown>,
  ) => ({
    acquired: true as const,
    result: await fn(),
  });

  beforeEach(async () => {
    expirePendingInvitations = jest
      .fn<Promise<number>, [Date]>()
      .mockResolvedValue(0);
    withLock = jest.fn(runWhenAcquired);
    const module = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationExpirationJob,
        {
          provide: WorkspaceInvitationService,
          useValue: { expirePendingInvitations },
        },
        { provide: RedisLockService, useValue: { withLock } },
      ],
    }).compile();
    job = module.get(WorkspaceInvitationExpirationJob);
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('以排程專用的 key 與 30 秒 TTL 取得鎖', async () => {
    // Act
    await job.handleCron();

    // Assert
    expect(withLock).toHaveBeenCalledWith(
      'lock:cron:expireWorkspaceInvitations',
      30_000,
      expect.any(Function),
    );
  });

  it('拿到鎖時以目前時間執行過期，有更新才記 log', async () => {
    // Arrange
    expirePendingInvitations.mockResolvedValue(2);
    const before = Date.now();

    // Act
    await job.handleCron();

    // Assert
    expect(expirePendingInvitations).toHaveBeenCalledTimes(1);
    const [now] = expirePendingInvitations.mock.calls[0];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
    expect(log).toHaveBeenCalledWith(
      { event: LOG_EVENTS.workspaceInvitationExpireCompleted, count: 2 },
      '已將過期的工作區邀請標記為 EXPIRED',
    );
  });

  it('沒有過期的邀請時不記 log', async () => {
    // Act
    await job.handleCron();

    // Assert
    expect(expirePendingInvitations).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('沒拿到鎖（別台主機正在執行）時不執行過期，也不記 log', async () => {
    // Arrange
    withLock.mockResolvedValue({ acquired: false });

    // Act
    await job.handleCron();

    // Assert
    expect(expirePendingInvitations).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('執行失敗時記 error 並帶 event，不往外丟', async () => {
    // Arrange
    const dbError = new Error('DB unavailable');
    expirePendingInvitations.mockRejectedValue(dbError);

    // Act
    const result = job.handleCron();

    // Assert
    // Rethrowing would make @nestjs/schedule log the same error again without an event.
    await expect(result).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      { event: LOG_EVENTS.workspaceInvitationExpireFailed, err: dbError },
      '過期邀請排程執行失敗',
    );
  });

  it('取得鎖時 Redis 故障也記 error，不往外丟', async () => {
    // Arrange
    const redisError = new Error('Redis unavailable');
    withLock.mockRejectedValue(redisError);

    // Act
    await job.handleCron();

    // Assert
    expect(expirePendingInvitations).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      { event: LOG_EVENTS.workspaceInvitationExpireFailed, err: redisError },
      '過期邀請排程執行失敗',
    );
  });
});
