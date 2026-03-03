const { Worker } = require("bullmq");
const { redisConnection } = require("../queue/bullmq.setup");
const { ContextCompilerService } = require("../core/contextCompiler.service");
const { llmProviderRouter } = require("../core/llmRouter.service");
const { logger } = require("../utils/logger");

/**
 * Phase 6 - Distributed Call Orchestrator Worker.
 * Executes the SBEC (Safe Behavioral Execution Contract) logic cross-regionally.
 */
const callWorker = new Worker("outbound-call-queue", async (job) => {
    const { protocol, tenantId } = job.data;

    logger.info({ jobId: job.id, tenantId, phone: protocol.phone_number, attempt: job.attemptsMade }, "Worker: Initiating Voice Behavioral Execution");
    const { reliabilityEngine } = require("../utils/reliability.service");

    try {
        // 1. Model Selection (Cost/Latency Aware + Circuit Breaker Wrapper)
        const model = await reliabilityEngine.execute("llm-router", async () => {
            return await llmProviderRouter.selectProvider(protocol);
        }, 2000); // 2s Timeout for routing decision

        // 2. Behavioral Prompt Generation (Adaptive Mode)
        const prompt = ContextCompilerService.compile(protocol, job.data.lastModifiers);

        logger.debug({ model, promptLength: prompt.length }, "Worker: SBEC Contract Compiled & Routed");

        return { status: "initiated", model, attempt: job.attemptsMade };
    } catch (err) {
        logger.error({ jobId: job.id, err: err.message }, "Worker: Reliable Execution Aborted");
        throw err; // Trigger standard BullMQ retry
    }
}, { connection: redisConnection, concurrency: 50 });

callWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Execution Job Completed Successfully"));

callWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job.id, err: err.message }, "Execution Job Failed");

    // Phase 6 - Dead Letter Queue (DLQ) Integration
    const { moveToDeadLetter } = require("../queue/bullmq.setup");
    if (job.attemptsMade >= job.opts.attempts) {
        await moveToDeadLetter(job, err);
    }
});

module.exports = { callWorker };
