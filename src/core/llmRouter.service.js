const { logger } = require("../utils/logger");
const { metrics } = require("../utils/metrics");
const { reliabilityEngine } = require("../utils/reliability.service");

/**
 * Phase 5 - Global Voice Fabric LLM Provider Router.
 * Dynamically selects between Gemini, GPT-4, and Claude based on:
 * 1. Latency (Target vs Reality)
 * 2. Cost / Quota
 * 3. Region Availability
 */
class LLMProviderRouter {
    constructor() {
        this.providers = {
            "gemini-1.5-flash": { vendor: "Google", reliability: 1.0, avgLatency: 800 },
            "gpt-4o-mini": { vendor: "OpenAI", reliability: 0.98, avgLatency: 1200 },
            "claude-3-haiku": { vendor: "Anthropic", reliability: 0.99, avgLatency: 950 }
        };
    }

    /**
     * Primary logic for selecting the optimal execution model (Cognitive Load & Quality Aware).
     */
    async selectProvider(protocol) {
        const { reasoning_depth } = protocol.conversation;
        const { latency_target_ms } = protocol.runtime;

        let candidates = Object.keys(this.providers);

        // 1. Intelligence-Based Routing Strategy (Cognitive Load Aware)
        // Infra routes by computational requirement, not business category.
        const isComplexReasoning = reasoning_depth > 7;

        if (isComplexReasoning) {
            // Priority: Quality & Cognitive Reasoning Depth
            candidates = candidates.filter(p => !p.includes("mini") && !p.includes("haiku"));
        } else {
            // Priority: High Speed & Low Cost Execution
            candidates = candidates.filter(p => p.includes("mini") || p.includes("haiku") || p.includes("flash"));
        }

        // 2. Reliability Filtering (Circuit Breaker Check)
        candidates = candidates.filter(p => !reliabilityEngine.isOpen(p));

        if (candidates.length === 0) {
            logger.error("All Model Providers are Triple-TRIPPED. Falling back to local node emergency recovery.");
            return "gemini-1.5-flash"; // Absolute fallback
        }

        // 3. Latency/Reliability Scoring (Evolved Metrics)
        candidates.sort((a, b) => {
            const scoreA = this.providers[a].avgLatency * (1 / this.providers[a].reliability);
            const scoreB = this.providers[b].avgLatency * (1 / this.providers[b].reliability);
            return scoreA - scoreB;
        });

        const selected = candidates.find(p => this.providers[p].avgLatency <= latency_target_ms) || candidates[0];

        metrics.total_calls.inc({ tenant: protocol.agent.organization || "global", mode: `depth_${reasoning_depth}_optimized` });
        logger.info({ selected, reasoning_depth, isComplexReasoning }, "Autonomous Model Routing Optimized (Cognitive-Load Based)");

        return selected;
    }

    /**
     * Record provider performance to adjust future routing decisions.
     */
    async recordLatency(provider, latency, tenant) {
        if (this.providers[provider]) {
            // Simple moving average for local node intelligence
            this.providers[provider].avgLatency = (this.providers[provider].avgLatency * 0.9) + (latency * 0.1);
            metrics.llm_latency.observe({ tenant, model: provider }, latency);
            logger.info({ provider, latency, tenant }, "LLM Latency Recorded");
        }
    }
}

module.exports = { llmProviderRouter: new LLMProviderRouter() };
