import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { AlertMatcherService } from './alert-matcher.service';

const QUEUE_NAME = 'availability-events';

/**
 * Background processing of availability events.
 * - With REDIS_URL: BullMQ queue + worker (retries, survives restarts). The
 *   history id is used as the job id, so an event is never enqueued twice.
 * - Without Redis (local development): processed in-process after the
 *   response, with the same idempotent matcher.
 */
@Injectable()
export class AvailabilityEventsQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvailabilityEventsQueue.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly config: ConfigService,
    private readonly matcher: AlertMatcherService,
  ) {}

  get mode(): 'bullmq' | 'inline' {
    return this.queue ? 'bullmq' : 'inline';
  }

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — availability events are processed in-process (development fallback)');
      return;
    }
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.matcher.processAvailabilityEvent(job.data.historyId as string),
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err.message}`));
    this.logger.log('Availability events use BullMQ (Redis)');
  }

  async enqueue(historyIds: string[]): Promise<void> {
    if (historyIds.length === 0) return;
    if (this.queue) {
      await this.queue.addBulk(
        historyIds.map((historyId) => ({ name: 'availability-event', data: { historyId }, opts: { jobId: historyId } })),
      );
      return;
    }
    const run = (async () => {
      for (const id of historyIds) {
        try {
          await this.matcher.processAvailabilityEvent(id);
        } catch (err) {
          this.logger.error(`Failed to process availability event ${id}: ${(err as Error).message}`);
        }
      }
    })();
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
  }

  /** Waits for in-process work (used by tests and graceful shutdown). */
  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  async onModuleDestroy() {
    await this.drain();
    await this.worker?.close();
    await this.queue?.close();
  }
}
