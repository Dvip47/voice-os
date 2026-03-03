const { Worker } = require("bullmq");
const { redisConnection } = require("../queue/bullmq.setup");
const { ContextCompilerService } = require("../core/contextCompiler.service");
const { llmProviderRouter } = require("../core/llmRouter.service");
const { logger } = require("../utils/logger");
const { WebhookService } = require("../services/webhook.service");

/**
 * Phase 6 - Distributed Call Orchestrator Worker (v1.2).
 */
const callWorker = new Worker("outbound-call-queue", async (job) => {
    const { protocol, tenantId } = job.data;
    const phone = protocol.target.phone_number;

    logger.info({ jobId: job.id, tenantId, phone, attempt: job.attemptsMade }, "Worker: Initiating Voice Behavioral Execution");
    const { reliabilityEngine } = require("../utils/reliability.service");

    try {
        // 1. Model Selection
        const model = await reliabilityEngine.execute("llm-router", async () => {
            return await llmProviderRouter.selectProvider(protocol);
        }, 2000);

        // 2. Behavioral Prompt Generation
        const prompt = ContextCompilerService.compile(protocol, job.data.lastModifiers);

        // 3. Trigger Webhook Callbacks if URL defined (v1.2 Hardening)
        if (protocol.callbacks?.webhook_url) {
            await WebhookService.dispatch({
                event: "call.initiated",
                job_id: job.id,
                phone,
                timestamp: Date.now()
            }, protocol.callbacks.webhook_url, protocol.callbacks.signing_secret_id || "default_uvr_secret");
        }

        return { status: "initiated", model, attempt: job.attemptsMade };
    } catch (err) {
        logger.error({ jobId: job.id, err: err.message }, "Worker: Reliable Execution Aborted");

        // Callback on Failure
        if (protocol.callbacks?.webhook_url) {
            await WebhookService.dispatch({
                event: "call.failed",
                job_id: job.id,
                error: err.message,
                timestamp: Date.now()
            }, protocol.callbacks.webhook_url, protocol.callbacks.signing_secret_id || "default_uvr_secret");
        }

        throw err;
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
