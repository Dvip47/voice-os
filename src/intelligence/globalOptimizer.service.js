const { logger } = require("../utils/logger");
const { redisConnection } = require("../queue/bullmq.setup");
const { metrics } = require("../utils/metrics");

/**
 * Phase 6 - Autonomous Global Intelligence Loop.
 * Analyzes cross-tenant patterns to evolve behavioral rules and routing logic.
 */
class GlobalOptimizerService {
    constructor() {
        this.rulesKey = "global:behavioral:rules";
        this.historyKey = "global:behavioral:rules:history";
        this.patternsKey = "global:behavioral:patterns";

        // Base Baseline Rules (to be evolved)
        this.defaultRules = {
            version: 1,
            evolution_disabled: false,
            interruption_trigger: 3.0,
            verbosity_adjustment_multiplier: 1.0,
            optimal_pace_by_region: {}
        };
    }

    /**
     * Aggregates a completed call's final signals into global pattern store.
     */
    async recordCallOutcome(jobId, finalSignals) {
        const { tenant, reasoning_depth, region, success, avgSentiment, interruptions } = finalSignals;

        // Multi-dimensional pattern key (Abstract: Depth + Region)
        const patternKey = `depth_${reasoning_depth}:${region}`;

        logger.info({ jobId, patternKey, success }, "Autonomous Loop: Ingesting Call Outcome");

        // Atomic increment of successes/fails and averages (HINCRBYFLOAT/HINCRBY)
        await redisConnection.hincrby(this.patternsKey, `${patternKey}:total`, 1);
        if (success) await redisConnection.hincrby(this.patternsKey, `${patternKey}:success`, 1);

        // Track if current 'interruption_trigger' was too high or too low
        if (interruptions > 0 && !success) {
            await redisConnection.hincrbyfloat(this.patternsKey, `${patternKey}:neg_agg_interruptions`, interruptions);
        }

        metrics.total_calls.inc({ tenant, mode: `depth_${reasoning_depth}_optimized` });
    }

    /**
     * Periodic Refinement Engine.
     * Evolve constants based on success ratios with version control.
     */
    async evolveGlobalRules() {
        const currentRules = await this.getRules();

        if (currentRules.evolution_disabled) {
            logger.warn("Autonomous Loop: Evolution is currently DISABLED (Manual Override)");
            return;
        }

        logger.info({ currentVersion: currentRules.version }, "Autonomous Loop: Starting Global Rule Evolution");

        try {
            const patterns = await redisConnection.hgetall(this.patternsKey);
            const nextRules = JSON.parse(JSON.stringify(currentRules));
            nextRules.version++;

            // Strategy 1: Interruption Threshold Tuning
            for (const key in patterns) {
                if (key.endsWith(":neg_agg_interruptions")) {
                    const modeRegion = key.replace(":neg_agg_interruptions", "");
                    const total = parseInt(patterns[`${modeRegion}:total`]);
                    const negInterruptions = parseFloat(patterns[key]);

                    if (total > 100 && (negInterruptions / total) > 2.0) {
                        logger.warn({ modeRegion }, "Autonomous Loop: High failure correlation. Lowering trigger.");
                        nextRules.interruption_trigger = Math.max(1, nextRules.interruption_trigger - 0.1);
                    }
                }
            }

            // Save Evolved Rules with History persistence
            await redisConnection.hset(this.historyKey, `v${currentRules.version}`, JSON.stringify(currentRules));
            await redisConnection.set(this.rulesKey, JSON.stringify(nextRules));

            logger.info({ newVersion: nextRules.version }, "Autonomous Loop: Ruleset Evolution Complete");
        } catch (err) {
            logger.error({ err }, "Global Rule Evolution Loop Failed");
        }
    }

    /**
     * Reverts behavioral rules to a previous stable version.
     */
    async rollbackToVersion(versionNumber) {
        const historyData = await redisConnection.hget(this.historyKey, `v${versionNumber}`);
        if (!historyData) {
            throw new Error(`Rollback Failed: Version v${versionNumber} not found in history.`);
        }

        const rolledBackRules = JSON.parse(historyData);
        await redisConnection.set(this.rulesKey, JSON.stringify(rolledBackRules));
        logger.warn({ version: versionNumber }, "EMERGENCY ROLLBACK: Behavioral rules reverted.");
        return rolledBackRules;
    }

    /**
     * Strategy Evolution: Payload Suggestion Engine.
     */
    async analyzePayload(protocol) {
        const suggestions = [];
        const rules = await this.getRules();

        if (protocol.objective.primary_goal.length < 20) {
            suggestions.push("Primary goal is too short. Suggest detailing specific user intent.");
        }

        if (!protocol.objective.success_condition) {
            suggestions.push("Missing success_condition. Behavior will be non-deterministic.");
        }

        const optimalPace = rules.optimal_pace_by_region[protocol.runtime.region];
        if (optimalPace) {
            logger.info({ region: protocol.runtime.region }, "Applying regional voice optimization tips.");
        }

        return suggestions;
    }

    async getRules() {
        try {
            const rules = await redisConnection.get(this.rulesKey);
            return rules ? JSON.parse(rules) : this.defaultRules;
        } catch (err) {
            logger.error({ err }, "Failed to fetch rules, using defaults");
            return this.defaultRules;
        }
    }
}

module.exports = { GlobalOptimizerService: new GlobalOptimizerService() };
