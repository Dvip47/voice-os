const { z } = require("zod");
const { logger } = require("../../utils/logger");

/**
 * Domain Neutral Call Execution Protocol (v1.0)
 * Pure behavioral contract for generic voice execution.
 */

// PII Redaction Utility for Production Logs
const redactPII = (val) => {
    if (typeof val !== "string") return val;
    return val
        .replace(/[\w\.-]+@[\w\.-]+\.\w{2,4}/gi, "[EMAIL_REDACTED]")
        .replace(/\+?\d{10,15}/g, "[PHONE_REDACTED]")
        .replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, "[CC_REDACTED]");
};
const CallExecutionSchema = z.object({
    protocol_version: z.string().regex(/^1\.\d+$/, "Only v1.x protocols supported currently."),
    phone_number: z.string().regex(/^\+\d{10,15}$/, "Invalid E.164 phone format."),

    agent: z.object({
        name: z.string().min(1).max(30),
        role: z.string().min(1).max(50),
        organization: z.string().max(100).optional(),
        authority_level: z.enum(["Standard", "Elevated", "Admin", "Restricted"]).default("Standard"),
    }),

    knowledge: z.object({
        scope: z.string().min(10).max(1000),
        allowed_material: z.array(z.string().max(200)).max(10).default([]),
        depth: z.enum(["Standard", "Expert", "Simplified"]).default("Standard"),
        external_lookup: z.boolean().default(false),
    }),

    conversation: z.object({
        language: z.string().max(20).default("English"),
        tone: z.string().max(50).default("Balanced"),
        style: z.enum(["Concise", "Verbose", "Natural", "Formal"]).default("Concise"),

        // Behavioral Geometry (Pure Behavioral Math)
        behavioral_profile: z.object({
            verbosity: z.number().min(0).max(1).default(0.5),
            directness: z.number().min(0).max(1).default(0.5),
            exploration_bias: z.number().min(0).max(1).default(0.3),
            authority_projection: z.number().min(0).max(1).default(0.5),
        }).default({}),

        // Interaction Strategy (Abstract Logic)
        interaction_strategy: z.object({
            dialogic: z.boolean().default(true),
            clarification_allowed: z.boolean().default(true),
            multi_turn: z.boolean().default(true),
            ack_only: z.boolean().default(false),
        }).default({}),

        reasoning_depth: z.number().int().min(1).max(10).default(5),
        response_limit_words: z.number().int().min(10).max(250).default(100),
        max_turns: z.number().int().min(1).max(50).default(10),
    }),

    objective: z.object({
        primary_goal: z.string().min(10).max(500),
        success_condition: z.string().max(300).optional(),
        end_behavior: z.string().max(300).default("Summarize and close politely"),
    }),

    memory: z.object({
        enabled: z.boolean().default(true),
        scope: z.enum(["Call", "Persistent", "None"]).default("Call"),
        summarize_on_completion: z.boolean().default(true),
    }).default({}),

    constraints: z.object({
        forbidden_topics: z.array(z.string().max(100)).max(20).default([]),
        strict_scope_enforcement: z.boolean().default(true),
        uncertainty_policy: z.string().max(200).default("Admit when unsure"),
    }).default({}),

    runtime: z.object({
        max_call_duration_sec: z.number().int().min(30).max(1800).default(300),
        latency_target_ms: z.number().int().min(500).max(5000).default(1500),
        webhook_url: z.string().url().max(500).optional(),
        region: z.enum([
            "ap-south-1",   // Mumbai
            "me-central-1", // UAE
            "eu-west-1",    // Ireland
            "us-east-1",    // Virginia
            "auto"          // Latency-based
        ]).default("auto"),
        data_residency: z.enum(["Standard", "Strict", "LocalOnly"]).default("Standard"),
    }).default({}),
});

/**
 * API Key Middleware.
 * Prevents unauthorized access and maps keys to quotas.
 */
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const VALID_API_KEYS = [process.env.INTERNAL_API_KEY || "voice_dev_123"];

    if (!apiKey || !VALID_API_KEYS.includes(apiKey)) {
        logger.warn({ apiKey }, "Unauthorized API Access Attempt");
        return res.status(401).json({ error: "Invalid or missing API key." });
    }

    // Inject tenant metadata if needed
    req.tenant = { id: "default_tenant", rate_limit: 100 };
    next();
};

const { GlobalOptimizerService } = require("../../intelligence/globalOptimizer.service");

/**
 * Request Validation Middleware with Payload Intelligence.
 */
const validateCallRequest = async (req, res, next) => {
    try {
        const validated = CallExecutionSchema.parse(req.body);
        req.body = validated;

        // Phase 6 - Payload Intelligence Check
        const suggestions = await GlobalOptimizerService.analyzePayload(validated);
        if (suggestions.length > 0) {
            logger.info({ suggestions: suggestions.map(s => redactPII(s)), tenant: req.tenant.id }, "Autonomous Payload Suggestions Generated");
            // Attach to response headers for developer visibility
            res.set("X-Payload-Intelligence", redactPII(suggestions.join("; ")));
        }

        next();
    } catch (err) {
        logger.error({ errors: err.issues || err.errors }, "Invalid Request Body Schema");
        return res.status(400).json({
            error: "Schema Validation Failed",
            details: err.issues || err.errors || err.message
        });
    }
};

module.exports = { authenticateApiKey, validateCallRequest };
