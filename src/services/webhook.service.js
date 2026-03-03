const axios = require("axios");
const crypto = require("crypto");
const { logger } = require("../utils/logger");

/**
 * Phase 6 - Reliable Webhook Dispatcher (v1.2 Hardening)
 * Implements exponential backoff, HMAC signing and retry policy.
 */
class WebhookService {
    /**
     * Dispatches a signed event to the client's webhook URL.
     */
    static async dispatch(payload, webhookUrl, signingSecret, retryPolicy = "exponential_3") {
        if (!webhookUrl) return;

        const maxRetries = 3;
        const baseDelay = 1000; // 1s
        const timeout = 2000; // 2s timeout per attempt

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const timestamp = Date.now().toString();
                const body = JSON.stringify(payload);

                // HMAC SHA256 Signature (Enterprise Grade)
                const signature = crypto.createHmac("sha256", signingSecret)
                    .update(timestamp + body)
                    .digest("hex");

                await axios.post(webhookUrl, body, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-UVR-Timestamp": timestamp,
                        "X-UVR-Signature": `sha256=${signature}`
                    },
                    timeout
                });

                logger.info({ webhookUrl, attempt }, "Webhook Dispatch Success");
                const { metrics } = require("../utils/metrics");
                metrics.webhook_delivery_rate.set({ tenant: payload.tenantId || "default" }, 1);
                return true;
            } catch (err) {
                const { metrics } = require("../utils/metrics");
                metrics.carrier_failure_rate.inc({ region: payload.region || "auto", error_type: "webhook_timeout" });
                const delay = baseDelay * Math.pow(3, attempt - 1);
                logger.warn({ webhookUrl, attempt, error: err.message, nextRetryIn: `${delay}ms` }, "Webhook Dispatch Failed. Retrying...");

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        logger.error({ webhookUrl }, "Webhook Dispatch Exhausted: Moving to Dead Letter (Mock)");
        // In a real scenario, this would push to a specialized DLQ for webhooks
        return false;
    }
}

module.exports = { WebhookService };
