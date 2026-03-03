const { GlobalOptimizerService } = require("../intelligence/globalOptimizer.service");

/**
 * Phase 6 - Autonomous Adaptive Intelligence Engine.
 * Modulates behavior mid-call based on evolved global rules.
 */
class AdaptiveEngineService {
    /**
     * Generates behavioral modifiers based on real-time signals and evolved rules.
     */
    static async generateModifiers(signals, protocol) {
        const { sentiment, interruptions, speakingSpeed, durationRatio, turnsRatio } = signals;
        const { region } = protocol.runtime;

        // Fetch Evolved Rules from Global Intelligence Layer
        const evolvedRules = await GlobalOptimizerService.getRules();
        const regionalOptimization = evolvedRules.optimal_pace_by_region[region] || { rate: 1.0, pitch: "0st" };

        // Default baseline (with evolved triggers)
        const modifiers = {
            tone_modifier: "Maintain evolved baseline",
            response_length_adjustment: 0,
            directness_level: protocol.conversation.style,
            tts_rate: regionalOptimization.rate,
            tts_pitch: regionalOptimization.pitch,
            objective_push_factor: 1.0,
            conclusion_phase: false
        };

        // 1. Sentiment-Driven Tone & TTS Adaptation
        if (sentiment < -0.4) {
            modifiers.tone_modifier = "Empathetic, calm, and de-escalating. Use soft language.";
            modifiers.tts_rate *= 0.88; // Slower for empathy
            modifiers.tts_pitch = "-1st";
        }

        // 2. Interruption-Driven Behavior (Learned Threshold)
        if (interruptions >= evolvedRules.interruption_trigger) {
            modifiers.tone_modifier += ` | [REFINED] High interruptions (${interruptions}) detected. Yield control faster.`;
            modifiers.response_length_adjustment = -40 * evolvedRules.verbosity_adjustment_multiplier;
            modifiers.tts_rate *= 1.1;
        }

        // 3. Time/Turn Pressure Acceleration
        if (durationRatio > 0.8 || turnsRatio > 0.8) {
            modifiers.tone_modifier += " | [AUTONOMOUS] Approaching session limit. Finalizing objective.";
            modifiers.conclusion_phase = true;
            modifiers.objective_push_factor = 2.0;
            modifiers.response_length_adjustment = -20;
        }

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
