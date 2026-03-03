const { GlobalOptimizerService } = require("../intelligence/globalOptimizer.service");

/**
 * Phase 6 - Autonomous Adaptive Intelligence Engine.
 * Modulates behavior mid-call based on evolved global rules.
 */
class AdaptiveEngineService {
    /**
     * Generates behavioral modifiers based on real-time signals and evolved rules.
     */
    static async generateModifiers(signals, protocol, previousModifiers = null) {
        const { sentiment, interruptions, durationRatio, turnsRatio } = signals;
        const region = protocol.execution?.region || protocol.runtime?.region || "auto";
        const profile = protocol.runtime?.telephony_profile || "standard";

        // Phase 6 - India PSTN Stability Constraints
        const constraints = {
            maxTtsDelta: profile === "india_standard" ? 0.03 : 0.1,
            maxAuthorityDelta: 0.05,
            cooldownTurns: 3,
            ttsRateRange: { min: 0.85, max: 1.05 }
        };

        // Fetch Evolved Rules from Global Intelligence Layer
        const evolvedRules = await GlobalOptimizerService.getRules();
        const regionalOptimization = evolvedRules.optimal_pace_by_region[region] || { rate: 1.0, pitch: "0st" };

        const modifiers = {
            tone_modifier: "Maintain evolved baseline",
            response_length_adjustment: 0,
            directness_level: protocol.conversation.style || "Balanced",
            tts_rate: regionalOptimization.rate,
            tts_pitch: regionalOptimization.pitch,
            authority_projection: protocol.agent.authority_level || 0.5,
            objective_push_factor: 1.0,
            conclusion_phase: false,
            cooldown: previousModifiers?.cooldown > 0 ? previousModifiers.cooldown - 1 : 0
        };

        // 1. Adaptive Cooldown Protection
        if (modifiers.cooldown > 0) {
            return {
                ...previousModifiers,
                cooldown: modifiers.cooldown
            };
        }

        // 2. Sentiment-Driven Tone & TTS Adaptation
        if (sentiment < -0.4) {
            modifiers.tone_modifier = "Empathetic, calm, and de-escalating. Use soft language.";
            modifiers.tts_rate *= 0.88;
            modifiers.tts_pitch = "-1st";
            modifiers.cooldown = constraints.cooldownTurns;
        }

        // 3. Interruption-Driven Behavior (Learned Threshold)
        if (interruptions >= evolvedRules.interruption_trigger) {
            modifiers.tone_modifier += ` | [REFINED] High interruptions detected. Yield control faster.`;
            modifiers.response_length_adjustment = -40;
            modifiers.tts_rate *= 1.1;
            modifiers.authority_projection -= 0.1;
            modifiers.cooldown = constraints.cooldownTurns;
        }

        // 4. Time/Turn Pressure Acceleration
        if (durationRatio > 0.8 || turnsRatio > 0.8) {
            modifiers.tone_modifier += " | [AUTONOMOUS] Approaching session limit.";
            modifiers.conclusion_phase = true;
            modifiers.objective_push_factor = 2.0;
            modifiers.response_length_adjustment = -20;
        }

        // Phase 6 - India PSTN Clamping & Safety
        if (previousModifiers) {
            // Clamp TTS Rate Shift
            const rateDelta = modifiers.tts_rate - previousModifiers.tts_rate;
            if (Math.abs(rateDelta) > constraints.maxTtsDelta) {
                modifiers.tts_rate = previousModifiers.tts_rate + (Math.sign(rateDelta) * constraints.maxTtsDelta);
            }

            // Clamp Authority Shift
            const prevAuth = previousModifiers.authority_projection || protocol.agent.authority_level;
            const authDelta = modifiers.authority_projection - prevAuth;
            if (Math.abs(authDelta) > constraints.maxAuthorityDelta) {
                modifiers.authority_projection = prevAuth + (Math.sign(authDelta) * constraints.maxAuthorityDelta);
            }
        }

        // Absolute Safety Caps
        modifiers.tts_rate = Math.max(constraints.ttsRateRange.min, Math.min(constraints.ttsRateRange.max, modifiers.tts_rate));

        return modifiers;
    }

    /**
     * Heuristic for sentiment polarity (Domain-Neutral).
     * Focuses on generic polarity keywords rather than domain rejections.
     */
    static extractSentiment(text) {
        const positive = [/great/i, /yes/i, /agree/i, /good/i, /perfect/i, /awesome/i, /correct/i, /thanks/i];
        const negative = [/no/i, /bad/i, /wrong/i, /unhappy/i, /stop/i, /incorrect/i, /disagree/i];

        let score = 0;
        positive.forEach(p => { if (p.test(text)) score += 0.2; });
        negative.forEach(n => { if (n.test(text)) score -= 0.3; });

        return Math.max(-1, Math.min(1, score));
    }
}

module.exports = { AdaptiveEngineService };
