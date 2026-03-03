const { authenticateApiKey, validateCallRequest } = require("./security");
const { StateService } = require("../../services/redis/state.service");
const { logger } = require("../../utils/logger");

/**
 * Phase 3 - Rate & Concurrency Isolation.
 * Protects infrastructure from noisy neighbors and ensures delivery.
 */
const rateIsolationMiddleware = async (req, res, next) => {
    const apiKey = req.headers["x-api-key"] || "default_tenant";

    // Per-Key Limits (From Config/DB)
    const MAX_RPM = parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60;
    const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_CALLS) || 20;

    try {
        // 1. Emergency Tenant Kill Switch
        if (await StateService.isTenantBlocked(apiKey)) {
            logger.error({ apiKey }, "Access Denied: Tenant is under emergency lockout.");
            return res.status(403).json({ error: "Access Denied (Emergency Kill Switch Active)" });
        }

        // 2. Global Backpressure Protection
        const saturation = await StateService.getQueueSaturation();
        const SATURATION_THRESHOLD = parseInt(process.env.QUEUE_SATURATION_THRESHOLD) || 500;
        if (saturation > SATURATION_THRESHOLD) {
            logger.warn({ saturation, threshold: SATURATION_THRESHOLD }, "Infrastructure Saturated: Applying Backpressure");
            return res.status(503).json({
                error: "Service Saturated",
                message: "Infrastructure is under heavy load. Please retry with exponential backoff.",
                retry_after_ms: 5000
            });
        }

        // 3. Check Rate Limit (Requests per Minute)
        if (await StateService.checkRateLimit(apiKey, MAX_RPM)) {
            logger.warn({ apiKey }, "Rate Limit Exceeded");
            return res.status(429).json({ error: "Too Many Requests (RPM Exceeded)" });
        }

        // 4. Check Active Concurrency (Calls actually in progress)
        if (await StateService.checkConcurrency(apiKey, MAX_CONCURRENT)) {
            logger.warn({ apiKey }, "Concurrency Limit Exceeded");
            return res.status(429).json({ error: "Maximum Concurrent Calls Exceeded" });
        }

        next();
    } catch (err) {
        logger.error({ err: err.message }, "Rate Isolation System Error");
        next(); // Fail open for safety or next(err) for strictness
    }
};

module.exports = { rateIsolationMiddleware };
