const { z } = require("zod");
const { logger, redactPII } = require("../../utils/logger");

const crypto = require("crypto");
const { StateService } = require("../../services/redis/state.service");

/**
 * Domain Neutral Call Execution Protocol (v1.2)
 * High-performance, distributed integration schema.
 */

const CallExecutionSchema = z.object({
    protocol_version: z.literal("1.2"),

    execution: z.object({
        region: z.enum(["ap-south-1", "me-central-1", "eu-west-1", "us-east-1", "auto"]).default("auto"),
        priority: z.enum(["standard", "high"]).default("standard"),
        idempotency_key: z.string().min(1).max(100).optional()
    }),

    target: z.object({
        phone_number: z.string().regex(/^\+\d{10,15}$/, "E.164 required")
    }),

    agent: z.object({
        name: z.string().min(1).max(30),
        role: z.string().min(1).max(50),
        authority_level: z.number().min(0).max(1).default(0.5)
    }),

    knowledge: z.object({
        scope: z.string().min(10).max(1000),
        external_lookup: z.boolean().default(false),
        depth: z.enum(["standard", "deep"]).default("standard")
    }),

    conversation: z.object({
        language: z.string().max(20).default("English"),
        reasoning_depth: z.number().int().min(1).max(10).default(5),
        max_turns: z.number().int().min(1).max(30).default(10),
        response_limit_words: z.number().int().min(10).max(300).default(100),
        behavioral_profile: z.object({
            verbosity: z.number().min(0).max(1).default(0.5),
            directness: z.number().min(0).max(1).default(0.5),
            exploration_bias: z.number().min(0).max(1).default(0.3),
            authority_projection: z.number().min(0).max(1).default(0.5)
        }).strict()
    }).strict(),

    objective: z.object({
        primary_goal: z.string().min(10).max(500),
        success_condition: z.string().min(1).max(300), // Reject objective conflicts: 400 if empty.
        end_behavior: z.string().max(300).default("Summarize and close politely")
    }),

    memory: z.object({
        enabled: z.boolean().default(true),
        scope: z.enum(["call", "persistent"]).default("call"),
        summarize_on_completion: z.boolean().default(true)
    }).default({}),

    constraints: z.object({
        forbidden_topics: z.array(z.string().max(100)).max(20).default([]),
        strict_scope_enforcement: z.boolean().default(true),
        uncertainty_policy: z.enum(["explicit", "conservative"]).default("conservative")
    }).default({}),

    callbacks: z.object({
        webhook_url: z.string().url().max(500).optional(),
        retry_policy: z.enum(["exponential_3"]).default("exponential_3"),
        signing_secret_id: z.string().max(64).optional()
    }).default({}),

    runtime: z.object({
        telephony_profile: z.enum(["standard", "india_standard"]).default("standard"),
        max_call_duration_sec: z.number().int().min(30).max(1800).default(300),
        latency_target_ms: z.number().int().min(500).max(5000).default(1500)
    }).default({})
}).strict().superRefine((data, ctx) => {
    // Phase 6 - India Region Enforcement
    if (data.target.phone_number.startsWith("+91") &&
        data.execution.region !== "ap-south-1" &&
        data.execution.region !== "auto") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Indian PSTN (+91) requires ap-south-1 (Mumbai) or auto for latency compliance.",
            path: ["execution", "region"]
        });
    }
});

/**
 * Constant-time comparison for API keys.
 */
const compareKeys = (provided, stored) => {
    if (!provided || !stored) return false;
    const providedBuffer = Buffer.from(provided);
    const storedBuffer = Buffer.from(stored);
    if (providedBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, storedBuffer);
};

/**
 * API Key Middleware (v1.2 Hardening).
 */
const authenticateApiKey = async (req, res, next) => {
    const apiKeyRaw = req.headers["x-api-key"];
    const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "voice_dev_123";

    if (!apiKeyRaw || !compareKeys(apiKeyRaw, INTERNAL_KEY)) {
        logger.warn("Unauthorized API Access Attempt");
        return res.status(401).json({ error: "Invalid or missing API key." });
    }

    // Tenant Mapping (Simulation)
    req.tenant = {
        id: "corporate_test",
        max_rpm: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 120,
        max_concurrent_calls: parseInt(process.env.MAX_CONCURRENT_CALLS) || 50
    };

    next();
};

/**
 * Request Validation with v1.2 Protocol Enforcement.
 */
const validateCallRequest = async (req, res, next) => {
    const protocolVersion = req.body.protocol_version;

    // Reject missing protocol_version or return 426
    if (!protocolVersion) {
        return res.status(400).json({ error: "Missing required protocol_version." });
    }
    if (protocolVersion !== "1.2") {
        return res.status(426).json({
            error: "Upgrade Required",
            message: "This endpoint requires v1.2. Please update your client protocol."
        });
    }

    try {
        const validated = CallExecutionSchema.parse(req.body);

        // Pre-Queue Limit Enforcement (v1.2)
        if (await StateService.checkRateLimit(req.tenant.id, req.tenant.max_rpm)) {
            return res.status(429).json({ error: "API Rate Limit Exceeded (max_rpm)" });
        }
        if (await StateService.checkConcurrency(req.tenant.id, req.tenant.max_concurrent_calls)) {
            return res.status(429).json({ error: "Maximum Concurrent Calls Exceeded." });
        }

        req.body = validated;
        next();
    } catch (err) {
        logger.error({ issues: err.issues }, "Schema Validation Failed");
        return res.status(400).json({
            error: "Schema Validation Failed",
            details: err.issues
        });
    }
};

module.exports = { authenticateApiKey, validateCallRequest };
