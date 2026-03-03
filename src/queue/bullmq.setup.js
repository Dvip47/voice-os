const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const { logger } = require("../utils/logger");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Global Outbound Call Job Queue.
 * Using BullMQ for distributed state management.
 */
const callQueue = new Queue("outbound-call-queue", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { age: 3600 }, // Keep completed for 1hr
        removeOnFail: false // Keep failed for DLQ analysis
    },
});

/**
 * Dead Letter Queue (DLQ) for exhaustive failure analysis.
 */
const deadLetterQueue = new Queue("dead-letter-queue", { connection: redisConnection });

const moveToDeadLetter = async (job, err) => {
    logger.error({ jobId: job.id, err: err.message }, "EXHAUSTED RETRIES: Moving to Dead Letter Queue");
    await deadLetterQueue.add(`dead_${job.id}`, {
        originalJobId: job.id,
        data: job.data,
        error: err.message,
        failedAt: Date.now()
    });
};

module.exports = { callQueue, deadLetterQueue, redisConnection, moveToDeadLetter };
