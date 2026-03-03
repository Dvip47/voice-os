const { WebSocketServer } = require("ws");
const { logger } = require("../utils/logger");
const { StateService } = require("../services/redis/state.service");
const { metrics } = require("../utils/metrics");
const { AdaptiveEngineService } = require("../core/adaptiveEngine.service");

/**
 * Phase 4 - Adaptive Distributed Media Server.
 */
class MediaStreamServer {
    constructor() {
        this.wss = null;
        this.metrics = { activeCalls: 0 };
    }

    init(server) {
        this.wss = new WebSocketServer({ server, path: "/v1/call/stream" });

        this.wss.on("connection", async (ws, req) => {
            const params = new URLSearchParams(req.url.split("?")[1]);
            const jobId = params.get("job_id");
            const callSid = params.get("CallSid") || "unknown";

            if (!jobId) {
                logger.error("Media Stream Handshake Failed: Missing JobID");
                ws.terminate();
                return;
            }

            // Phase 4 - Runtime Signal Tracking
            const session = {
                startTime: Date.now(),
                interruptions: 0,
                turnCount: 0,
                lastSentiment: 0,
                avgSpeechSpeed: 140
            };

            this.metrics.activeCalls++;
            metrics.active_calls.inc({ node: process.env.HOSTNAME || "node-1" });
            logger.info({ jobId, callSid }, "Universal Voice Stream Active (Phase 4 Adaptive)");

            await StateService.setCallState(jobId, { status: "active", startTime: session.startTime });

            ws.on("message", async (msg) => {
                const data = JSON.parse(msg);

                if (data.event === "media") {
                    // Forward MULAW to STT...
                }

                if (data.event === "interruption") {
                    session.interruptions++;
                    this.handleBargeIn(jobId);
                }

                // MOCK STT CALL (Triggering Turn Adjustment)
                if (data.event === "stt_result" && data.final) {
                    session.turnCount++;
                    session.lastSentiment = AdaptiveEngineService.extractSentiment(data.text);

                    // Fetch Protocol and Compute Adaptive Modifiers
                    const state = await StateService.getCallState(jobId);
                    if (state && state.protocol) {
                        const durationRatio = (Date.now() - session.startTime) / (state.protocol.runtime.max_call_duration_sec * 1000);
                        const turnsRatio = session.turnCount / state.protocol.conversation.max_turns;

                        const modifiers = AdaptiveEngineService.generateModifiers({
                            sentiment: session.lastSentiment,
                            interruptions: session.interruptions,
                            speakingSpeed: session.avgSpeechSpeed,
                            durationRatio,
                            turnsRatio
                        }, state.protocol);

                        logger.info({ jobId, modifiers }, "Adaptive Pulse: Adjusting Next Turn Behavior");

                        // Save modifiers back to state for Worker to pick up
                        state.lastModifiers = modifiers;
                        await StateService.setCallState(jobId, state);
                    }
                }

                // Track Latency & Apply Graceful Degradation
                const latency = Date.now() - session.startTime;
                if (latency > 3000) {
                    logger.warn({ jobId, latency }, "Latency Spike Detected: Applying Graceful Degradation (Fast Mode)");
                }
            });

            ws.on("error", (err) => {
                logger.error({ jobId, err: err.message }, "Media Stream Socket Error");
            });

            ws.on("close", async () => {
                this.metrics.activeCalls--;
                metrics.active_calls.dec({ node: process.env.HOSTNAME || "node-1" });

                const duration = (Date.now() - session.startTime) / 1000;
                metrics.call_duration.observe({ status: "completed" }, duration);

                await this.completeCall(jobId, session);
            });
        });
    }

    async completeCall(jobId, session = {}) {
        const state = await StateService.getCallState(jobId);
        if (state) {
            state.status = "completed";
            state.endTime = Date.now();

            // Phase 6 - Autonomous Feedback Loop
            const finalSignals = {
                tenant: state.protocol?.agent?.organization || "default",
                reasoning_depth: state.protocol?.conversation?.reasoning_depth || 5,
                region: state.protocol?.runtime?.region || "auto",
                success: !!state.outcomeSuccess,
                avgSentiment: session.lastSentiment || 0,
                interruptions: session.interruptions || 0
            };

            const { GlobalOptimizerService } = require("../intelligence/globalOptimizer.service");
            await GlobalOptimizerService.recordCallOutcome(jobId, finalSignals);

            await StateService.setCallState(jobId, state);
        }
        logger.info({ jobId }, "Universal Runtime Stream Closed & Ingested into Global Intel");
    }

    handleBargeIn(jobId) {
        logger.info({ jobId }, "Barge-in: Cancelling queued TTS");
    }
}

module.exports = { mediaStreamServer: new MediaStreamServer() };
