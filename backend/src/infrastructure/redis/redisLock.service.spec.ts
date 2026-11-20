import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { RedisLockService } from './redisLock.service';
import { RedisService } from './redis.service';

describe('RedisLockService.withLock', () => {
  let service: RedisLockService;
  let client: { set: jest.Mock; releaseLock: jest.Mock };
  let warn: jest.SpyInstance;
  const key = 'lock:test:withLock';
  const ttlMs = 30_000;

  beforeEach(async () => {
    client = {
      set: jest.fn().mockResolvedValue('OK'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    const module = await Test.createTestingModule({
      providers: [
        RedisLockService,
        {
          provide: RedisService,
          useValue: { getClient: jest.fn().mockReturnValue(client) },
        },
      ],
    }).compile();
    service = module.get(RedisLockService);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** The owner withLock generated for this call (second argument of SET). */
  const acquiredOwner = (): string => {
    const [, owner] = client.set.mock.calls[0] as [string, string, unknown];
    return owner;
  };

  it('拿到鎖時執行 fn，回傳結果並以同一個 owner 釋放', async () => {
    // Arrange
    const fn = jest.fn().mockResolvedValue(3);

    // Act
    const outcome = await service.withLock(key, ttlMs, fn);

    // Assert
    expect(outcome).toEqual({ acquired: true, result: 3 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(key, expect.any(String), {
      expiration: { type: 'PX', value: ttlMs },
      condition: 'NX',
    });
    expect(client.releaseLock).toHaveBeenCalledWith({
      key,
      owner: acquiredOwner(),
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('每次呼叫使用不同的 owner', async () => {
    // Act
    await service.withLock(key, ttlMs, () => Promise.resolve());
    await service.withLock(key, ttlMs, () => Promise.resolve());

    // Assert
    const [[, first], [, second]] = client.set.mock.calls as [string, string][];
    expect(first).not.toBe(second);
  });

  it('沒拿到鎖時不執行 fn、不釋放、不記 log', async () => {
    // Arrange
    client.set.mockResolvedValue(null);
    const fn = jest.fn();

    // Act
    const outcome = await service.withLock(key, ttlMs, fn);

    // Assert
    expect(outcome).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    // Releasing here would report a false "lock lost" every time another instance holds it.
    expect(client.releaseLock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('取得鎖時 Redis 故障直接丟出，不執行 fn', async () => {
    // Arrange
    const redisError = new Error('Redis unavailable');
    client.set.mockRejectedValue(redisError);
    const fn = jest.fn();

    // Act
    const result = service.withLock(key, ttlMs, fn);

    // Assert
    await expect(result).rejects.toBe(redisError);
    expect(fn).not.toHaveBeenCalled();
    expect(client.releaseLock).not.toHaveBeenCalled();
  });

  it('fn 丟錯時仍釋放鎖，並原樣丟出 fn 的錯誤', async () => {
    // Arrange
    const fnError = new Error('updateMany failed');

    // Act
    const result = service.withLock(key, ttlMs, () => Promise.reject(fnError));

    // Assert
    await expect(result).rejects.toBe(fnError);
    expect(client.releaseLock).toHaveBeenCalledWith({
      key,
      owner: acquiredOwner(),
    });
  });

  it('釋放時鎖已不是自己的（fn 超過 TTL），記 warn redis.lock.lost 但仍回傳結果', async () => {
    // Arrange
    client.releaseLock.mockResolvedValue(false);

    // Act
    const outcome = await service.withLock(key, ttlMs, () =>
      Promise.resolve('done'),
    );

    // Assert
    expect(outcome).toEqual({ acquired: true, result: 'done' });
    expect(warn).toHaveBeenCalledWith(
      { event: LOG_EVENTS.redisLockLost, key },
      '鎖在執行途中失效',
    );
  });

  it('釋放時 Redis 故障只記 warn，不影響 fn 的結果', async () => {
    // Arrange
    const releaseError = new Error('Redis unavailable');
    client.releaseLock.mockRejectedValue(releaseError);

    // Act
    const outcome = await service.withLock(key, ttlMs, () =>
      Promise.resolve(1),
    );

    // Assert
    expect(outcome).toEqual({ acquired: true, result: 1 });
    expect(warn).toHaveBeenCalledWith(
      { event: LOG_EVENTS.redisLockReleaseFailed, key, err: releaseError },
      '釋放鎖失敗，等待 TTL 過期',
    );
  });

  it('fn 與釋放都失敗時，呼叫端拿到的是 fn 的錯誤', async () => {
    // Arrange
    const fnError = new Error('updateMany failed');
    const releaseError = new Error('Redis unavailable');
    client.releaseLock.mockRejectedValue(releaseError);

    // Act
    const result = service.withLock(key, ttlMs, () => Promise.reject(fnError));

    // Assert
    // A throw inside finally would replace fn's error and hide the real cause.
    await expect(result).rejects.toBe(fnError);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LOG_EVENTS.redisLockReleaseFailed,
        err: releaseError,
      }),
      expect.any(String),
    );
  });
});
