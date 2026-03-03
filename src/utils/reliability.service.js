const { logger } = require("./logger");

/**
 * Reliability Engine: Production Hardening Layer.
 * Implements Circuit Breakers, Timeouts, and sliding-window failure tracking.
 */
class ReliabilityEngine {
    constructor() {
        this.states = new Map(); // Store state for each dependency (STT, TTS, ProviderX)
        this.config = {
            failureThreshold: 5, // Trip after 5 failures in a window
            recoveryTimeMs: 30000, // Stay open for 30s before trying again
            windowSize: 10 // Track last 10 attempts
        };
    }

    /**
     * Executes an async operation with a circuit breaker and timeout.
     */
    async execute(serviceName, operation, timeoutMs = 5000) {
        if (this.isOpen(serviceName)) {
            logger.error({ serviceName }, "Circuit Breaker OPEN: Operation Aborted");
            throw new Error(`SERVICE_UNAVAILABLE: ${serviceName} is currently failing.`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const result = await operation(controller.signal);
            this.recordSuccess(serviceName);
            return result;
        } catch (err) {
            this.recordFailure(serviceName);
            if (err.name === 'AbortError') {
                throw new Error(`TIMEOUT: ${serviceName} exceeded ${timeoutMs}ms`);
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    isOpen(serviceName) {
        const state = this.states.get(serviceName);
        if (!state || state.status === 'CLOSED') return false;

        if (state.status === 'OPEN') {
            const now = Date.now();
            if (now - state.lastFailureTime > this.config.recoveryTimeMs) {
                logger.warn({ serviceName }, "Circuit Breaker: Entering HALF-OPEN state");
                state.status = 'HALF-OPEN';
                return false;
            }
            return true;
        }
        return false;
    }

    recordSuccess(serviceName) {
        const state = this.states.get(serviceName);
        if (state && state.status === 'HALF-OPEN') {
            logger.info({ serviceName }, "Circuit Breaker CLOSED: Service Recovered");
            this.states.set(serviceName, { status: 'CLOSED', failures: [] });
        }
    }

    recordFailure(serviceName) {
        let state = this.states.get(serviceName);
        if (!state) {
            state = { status: 'CLOSED', failures: [] };
        }

        state.failures.push(Date.now());
        if (state.failures.length > this.config.windowSize) {
            state.failures.shift();
        }

        if (state.failures.length >= this.config.failureThreshold || state.status === 'HALF-OPEN') {
            logger.error({ serviceName }, "Circuit Breaker TRIPPED: Potential Service Outage");
            state.status = 'OPEN';
            state.lastFailureTime = Date.now();
        }

        this.states.set(serviceName, state);
    }
}

module.exports = { reliabilityEngine: new ReliabilityEngine() };
