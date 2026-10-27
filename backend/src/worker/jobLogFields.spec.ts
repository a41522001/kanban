import type { Job } from 'bullmq';
import { jobLogFields } from './jobLogFields';

const createJob = (overrides: Partial<Job> = {}): Job =>
  ({
    queueName: 'avatar',
    name: 'generate-avatar-variants',
    id: 'avatar-variants-upload-1',
    attemptsStarted: 2,
    processedOn: undefined,
    data: { userId: 'user-1', uploadId: 'upload-1' },
    ...overrides,
  }) as Job;

describe('jobLogFields', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-27T12:00:01.250Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('回傳 queue、jobName、jobId、attempt 與本次處理花費的 durationMs', () => {
    // Arrange
    const job = createJob({
      processedOn: new Date('2026-10-27T12:00:00.000Z').getTime(),
    });

    // Act
    const fields = jobLogFields(job);

    // Assert
    expect(fields).toEqual({
      queue: 'avatar',
      jobName: 'generate-avatar-variants',
      jobId: 'avatar-variants-upload-1',
      attempt: 2,
      durationMs: 1250,
    });
  });

  it('尚未開始處理（沒有 processedOn）時 durationMs 為 undefined', () => {
    // Act
    const fields = jobLogFields(createJob({ processedOn: undefined }));

    // Assert
    expect(fields.durationMs).toBeUndefined();
  });

  it('不包含 job.data，避免 token、email 等資料進入 log', () => {
    // Act
    const fields = jobLogFields(createJob());

    // Assert
    expect(fields).not.toHaveProperty('data');
    expect(JSON.stringify(fields)).not.toContain('user-1');
  });
});
