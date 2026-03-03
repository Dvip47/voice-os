const { redisConnection } = require("../../queue/bullmq.setup");
const { logger } = require("../../utils/logger");

/**
 * Phase 3 - Distributed FSM State Store
 * Uses Redis as the centralized truth for all active calls.
 * Enables stateless horizontal scaling of Media Stream workers.
 */
class StateService {
    /**
     * Preserves call state across worker restarts/handovers.
     */
    static async setCallState(callSid, state) {
        const key = `call:state:${callSid}`;
        try {
            // TTL 1 hour to prevent Redis bloat from orphaned calls
            await redisConnection.set(key, JSON.stringify(state), "EX", 3600);
        } catch (err) {
            logger.error({ err, callSid }, "Redis State Save Failure");
        }
    }

    /**
     * Retrieves the current behavioral state of a call.
     */
    static async getCallState(callSid) {
        const key = `call:state:${callSid}`;
        try {
            const data = await redisConnection.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            logger.error({ err, callSid }, "Redis State Retrieve Failure");
            return null;
        }
    }

    /**
     * Atomic Turn Incrementor & Quota Check
     */
    static async incrementTurn(callSid, maxTurns) {
        const key = `call:turns:${callSid}`;
        const turns = await redisConnection.incr(key);
        if (turns === 1) await redisConnection.expire(key, 3600);
        return turns > maxTurns;
    }

    /**
     * Centralized Key-based Rate Limiter (Per Tenant / API Key)
     */
    static async checkRateLimit(apiKey, limitPerMinute) {
        const key = `ratelimit:${apiKey}`;
        const currentCount = await redisConnection.incr(key);
        if (currentCount === 1) await redisConnection.setex(key, 60, 1);
        return currentCount > limitPerMinute;
    }

    /**
     * Concurrency Guard (Active Calls per API Key)
     */
    static async checkConcurrency(apiKey, maxConcurrency) {
        const key = `concurrency:${apiKey}`;
        const currentActive = await redisConnection.get(key) || 0;
        return parseInt(currentActive) >= maxConcurrency;
    }

    /**
     * Emergency Kill Switch (Per-Tenant / API Key)
     */
    static async isTenantBlocked(apiKey) {
        const key = `tenant:blocked:${apiKey}`;
        const isBlocked = await redisConnection.get(key);
        return isBlocked === "true";
    }

    /**
     * Infrastructure Backpressure Monitor
     * Counts active and waiting jobs in BullMQ.
     */
    static async getQueueSaturation() {
        const { callQueue } = require("../../queue/bullmq.setup");
        const counts = await callQueue.getJobCounts("waiting", "active", "delayed");
        return counts.waiting + counts.active + counts.delayed;
    }

    /**
     * Idempotency Guard (Redis-based)
     */
    static async getIdempotentJob(tenantId, idempotencyKey) {
        const key = `idempotency:${tenantId}:${idempotencyKey}`;
        return await redisConnection.get(key);
    }

    static async setIdempotentJob(tenantId, idempotencyKey, jobId) {
        const key = `idempotency:${tenantId}:${idempotencyKey}`;
        // TTL 5 minutes per v1.2 requirement
        await redisConnection.set(key, jobId, "EX", 300);
    }

    /**
     * Retrieves current metadata from the state store for the status endpoint.
     */
    static async getCallStatus(jobId) {
        const key = `call:state:${jobId}`;
        const data = await redisConnection.get(key);
        if (!data) return null;

        const state = JSON.parse(data);
        return {
            status: state.status || "queued",
            duration_sec: state.endTime ? (state.endTime - state.startTime) / 1000 : 0,
            turns_used: state.turnCount || 0,
            termination_reason: state.termination_reason || "in_progress",
            region: state.protocol?.execution?.region || state.protocol?.runtime?.region || "auto"
        };
    }
}

module.exports = { StateService };
