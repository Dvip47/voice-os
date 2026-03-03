const { v4: uuidv4 } = require("uuid");
const { callQueue } = require("../../queue/bullmq.setup");
const { ContextCompilerService } = require("../../core/contextCompiler.service");
const { logger } = require("../../utils/logger");

/**
 * Main Controller for Universal Voice Execution API.
 * High-performance, non-blocking call orchestration.
 */
class CallController {
    /**
   * Triggers a new programmable AI call job based on the Domain Neutral Protocol (v1.0).
   * POST /v1/call/execute
   */
    static async execute(req, res) {
        const protocol = req.body;
        const { phone_number, runtime } = protocol;
        const jobId = `job_${uuidv4()}`;

        try {
            // 1. Compile the behavioral contract into a system prompt
            const systemPrompt = ContextCompilerService.compile(protocol);

            logger.info({ jobId, phone_number, agent: protocol.agent.name }, "Enqueuing Behavioral Contract Job");

            // 2. Enqueue for the Worker with the full contract + compiled prompt
            await callQueue.add(jobId, {
                job_id: jobId,
                phone_number,
                protocol: {
                    ...protocol,
                    compiled_system_prompt: systemPrompt
                },
                timestamp: Date.now(),
                status: "queued"
            });

            // 3. Return Job Receipt
            return res.status(202).json({
                job_id: jobId,
                status: "queued",
                protocol_version: protocol.protocol_version || "1.0",
                message: "Behavioral contract accepted for execution."
            });

        } catch (err) {
            logger.error({ err: err.message, jobId }, "Contract Enqueueing Failed");
            return res.status(500).json({ error: "Runtime Error", details: err.message });
        }
    }
}

module.exports = { CallController };
