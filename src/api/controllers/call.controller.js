const { v4: uuidv4 } = require("uuid");
const { callQueue } = require("../../queue/bullmq.setup");
const { ContextCompilerService } = require("../../core/contextCompiler.service");
const { logger } = require("../../utils/logger");
const { StateService } = require("../../services/redis/state.service");

/**
 * Main Controller for Universal Voice Execution API (v1.2).
 * High-performance, non-blocking call orchestration.
 */
class CallController {
    /**
    * Triggers a new programmable AI call job.
    * POST /v1/call/execute
    */
    static async execute(req, res) {
        const protocol = req.body;
        const tenantId = req.tenant.id;
        const phone = protocol.target.phone_number;
        const idempotencyKey = protocol.execution.idempotency_key;

        try {
            // 1. Idempotency Guard
            if (idempotencyKey) {
                const existingJobId = await StateService.getIdempotentJob(tenantId, idempotencyKey);
                if (existingJobId) {
                    logger.info({ tenantId, idempotencyKey, existingJobId }, "Idempotency Triggered: Returning existing job");
                    return res.status(200).json({
                        job_id: existingJobId,
                        status: "queued",
                        region: protocol.execution.region,
                        estimated_start_ms: 0,
                        idempotent: true
                    });
                }
            }

            const jobId = `job_${uuidv4()}`;

            // 2. Compile Behavioral Prompt
            const systemPrompt = ContextCompilerService.compile(protocol);

            logger.info({ jobId, phone, agent: protocol.agent.name }, "Enqueuing UVR v1.2 Behavioral Contract");

            // 3. Register Idempotency
            if (idempotencyKey) {
                await StateService.setIdempotentJob(tenantId, idempotencyKey, jobId);
            }

            // 4. Enqueue Job
            await callQueue.add(jobId, {
                job_id: jobId,
                tenantId,
                protocol: { ...protocol, compiled_system_prompt: systemPrompt },
                timestamp: Date.now()
            });

            // 5. Build v1.2 Response
            return res.status(202).json({
                job_id: jobId,
                status: "queued",
                region: protocol.execution.region,
                estimated_start_ms: 500, // Estimated overhead
                idempotent: false
            });

        } catch (err) {
            logger.error({ err: err.message }, "v1.2 Contract Enqueueing Failed");
            return res.status(500).json({ error: "Runtime Error", details: err.message });
        }
    }

    /**
     * Retrieves real-time status of an execution job.
     * GET /v1/call/status/:job_id
     */
    static async status(req, res) {
        const { job_id } = req.params;
        const status = await StateService.getCallStatus(job_id);

        if (!status) {
            return res.status(404).json({ error: "Job ID not found or expired." });
        }

        return res.json(status);
    }
}

module.exports = { CallController };
