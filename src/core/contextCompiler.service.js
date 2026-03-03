const { logger } = require("../utils/logger");

/**
 * Phase 2 - Hardened Context Compiler for Universal Voice Runtime.
 * Implements SBEC (Safe Behavioral Execution Contract) logic.
 */
class ContextCompilerService {
    /**
     * Cleans input to prevent prompt injection and system overrides.
     */
    static sanitize(input) {
        if (typeof input !== "string") return input;

        const forbiddenPatterns = [
            /ignore previous/i,
            /override system/i,
            /disregard instructions/i,
            /act as system/i,
            /your new role/i,
            /under no circumstances/i,
            /forget everything/i,
        ];

        let sanitized = input;
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(sanitized)) {
                logger.warn({ pattern, input }, "Potential Prompt Injection Detected and Neutralized");
                sanitized = sanitized.replace(pattern, "[SCRUBBED]");
            }
        }
        return sanitized;
    }

    /**
     * Normalizes the protocol into a Safe Behavioral Execution Contract (SBEC).
     */
    static normalize(protocol) {
        const sbec = JSON.parse(JSON.stringify(protocol)); // Deep clone

        // Apply sanitization to all textual fields
        sbec.agent.name = this.sanitize(sbec.agent.name);
        sbec.agent.role = this.sanitize(sbec.agent.role);
        sbec.knowledge.scope = this.sanitize(sbec.knowledge.scope);
        sbec.objective.primary_goal = this.sanitize(sbec.objective.primary_goal);
        sbec.objective.success_condition = this.sanitize(sbec.objective.success_condition);

        return sbec;
    }

    /**
     * Compiles the SBEC into a deterministic, block-structured system prompt.
     */
    static compile(rawProtocol, adaptiveModifiers = null) {
        const sbec = this.normalize(rawProtocol);
        const {
            agent,
            knowledge,
            conversation,
            objective,
            memory,
            constraints,
            runtime,
            protocol_version
        } = sbec;

        // Apply adaptive adjustments to core limits if provided
        const finalWordLimit = adaptiveModifiers
            ? Math.max(10, conversation.response_limit_words + (adaptiveModifiers.response_length_adjustment || 0))
            : conversation.response_limit_words;

        let prompt = `
=== PROTOCOL METADATA ===
Version: ${protocol_version}
Compliance: SBEC-v6-COMPUTE-NEUTRAL

=== IDENTITY ===
- Name: ${agent.name}
- Role: ${agent.role}
- Organization: ${agent.organization || "Independent"}
- Authority: ${agent.authority_level}
- Regional Cluster: ${runtime.region || "ap-south-1"} (Edge-Local Execution)

=== KNOWLEDGE BOUNDARY ===
- Primary Scope: ${knowledge.scope}
- Allowed Knowledge: ${Array.isArray(knowledge.allowed_material) ? knowledge.allowed_material.join(", ") : "Strictly limited to scope"}
- Knowledge Depth: ${knowledge.depth}
- External Tools: ${knowledge.external_lookup ? "ENABLED (Scoped)" : "DISABLED"}
${constraints.strict_scope_enforcement ? "- SCOPE ENFORCEMENT: STRICT. If a user asks anything outside the Primary Scope, you MUST decline to answer and restate your boundary." : ""}

=== BEHAVIORAL GEOMETRY ===
- Reasoning Depth: ${conversation.reasoning_depth} / 10
- Verbosity: ${conversation.behavioral_profile.verbosity}
- Directness: ${conversation.behavioral_profile.directness}
- Exploration Bias: ${conversation.behavioral_profile.exploration_bias}
- Authority Projection: ${conversation.behavioral_profile.authority_projection}

=== INTERACTION STRATEGY ===
- Dialogic Interaction: ${conversation.interaction_strategy.dialogic}
- Multi-Turn Enabled: ${conversation.interaction_strategy.multi_turn}
- Clarification Allowed: ${conversation.interaction_strategy.clarification_allowed}
- Acknowledgment-Only Mode: ${conversation.interaction_strategy.ack_only}

=== CONVERSATION STYLE ===
- Language: ${conversation.language} (STRICT)
- Tone Override: ${conversation.tone}
- Style Pattern: ${conversation.style}
- [GUARD] Response Word Limit: ${finalWordLimit} words. (ENFORCED)
`;

        // Inject Adaptive Tier if active signals detected
        if (adaptiveModifiers) {
            prompt += `
=== ADAPTIVE MODIFIER (REAL-TIME-COMPUTE) ===
- Dynamic Tone Adjustment: ${adaptiveModifiers.tone_modifier}
- Directness Delta: ${adaptiveModifiers.directness_level}
- Pacing Multiplier: ${adaptiveModifiers.tts_rate}
- Finalization Signal: ${adaptiveModifiers.conclusion_phase ? "TERMINAL" : "ACTIVE"}
- [INSTRUCTION] Override static behavioral constants with these situational modifiers.
`;
        }

        prompt += `
=== OBJECTIVE & SUCCESS ===
- Primary Objective: ${objective.primary_goal}
- Success Condition: ${objective.success_condition || "User intent fulfilled"}
- Completion Trigger: If Success Condition is met, transition immediately to End Behavior.
- End Behavior: ${objective.end_behavior}

=== CONSTRAINTS & SAFETY ===
- Forbidden Topics: ${Array.isArray(constraints.forbidden_topics) ? constraints.forbidden_topics.join(", ") : "None"}
- Uncertainty Policy: ${constraints.uncertainty_policy}
- Memory Persistence: ${memory && memory.enabled ? `Active (${memory.scope})` : "Disabled"}

=== HARD RUNTIME RULES ===
1. You are a VOICE interface. Responses must be phonetically natural.
2. NO markdown formatting beyond basic emphasis (*).
3. NO emojis, NO technical metadata, NO URLs.
4. If "success_condition" is detected in user state, say your closing line and end the call.
5. EXCEEDING ${finalWordLimit} WORDS WILL CAUSE RUNTIME TRUNCATION.
        `.trim();

        return prompt;
    }
}

module.exports = { ContextCompilerService };
