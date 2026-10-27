import type { Job } from 'bullmq';
/** Worker completed／failed 事件共用的 log 欄位。 */
export const jobLogFields = (job: Job) => {
  return {
    queue: job.queueName,
    jobName: job.name,
    jobId: job.id,
    attempt: job.attemptsStarted,
    durationMs: job.processedOn ? Date.now() - job.processedOn : undefined,
  };
};
