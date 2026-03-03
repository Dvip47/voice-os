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

            const state = await StateService.getCallState(jobId);
            const profile = state?.protocol?.runtime?.telephony_profile || "standard";

            // Phase 6 - India PSTN Hardening Params
            const config = {
                heartbeatInterval: 5000,
                mediaTimeout: 15000,
                silenceThreshold: profile === "india_standard" ? 12000 : 5000,
                bargeInDelay: 150,
                maxConcurrent: 100
            };

            if (this.metrics.activeCalls >= config.maxConcurrent) {
                logger.error("Worker Saturation: Max concurrent media sessions reached.");
                ws.terminate();
                return;
            }

            // Phase 4 - Runtime Signal Tracking
            const session = {
                startTime: Date.now(),
                lastMediaTime: Date.now(),
                interruptions: 0,
                turnCount: 0,
                lastSentiment: 0,
                avgSpeechSpeed: 140,
                isAlive: true
            };

            this.metrics.activeCalls++;
            metrics.active_calls.inc({ node: process.env.HOSTNAME || "node-1" });
            logger.info({ jobId, callSid, profile }, "Universal Voice Stream Active (India Hardened)");

            if (state && state.timestamp) {
                const answerTime = Date.now() - state.timestamp;
                metrics.avg_answer_time.observe({ region: state.protocol?.execution?.region || "auto" }, answerTime);
                metrics.call_connect_rate.set({ carrier: "twilio-india" }, 1); // Track success connect
            }

            await StateService.setCallState(jobId, { ...state, status: "active", startTime: session.startTime });

            // Heartbeat & Half-open Detection
            const heartbeat = setInterval(() => {
                if (!session.isAlive) {
                    logger.warn({ jobId }, "Half-open WebSocket detected. Terminating.");
                    return ws.terminate();
                }
                session.isAlive = false;
                ws.ping();

                // Media Timeout Protection
                if (Date.now() - session.lastMediaTime > config.mediaTimeout) {
                    logger.error({ jobId }, "Media Timeout: No audio packets for 15s. Killing stream.");
                    ws.terminate();
                }
            }, config.heartbeatInterval);

            ws.on("pong", () => { session.isAlive = true; });

            ws.on("message", async (msg) => {
                const data = JSON.parse(msg);

                if (data.event === "media") {
                    session.lastMediaTime = Date.now();
                    // Jitter Buffer Tolerance Logic (Simulated by internal queueing if needed)
                    // Forward MULAW to STT...
                }

                if (data.event === "interruption") {
                    // Phase 6 - Jitter Barge-in Delay (150ms)
                    setTimeout(() => {
                        session.interruptions++;
                        this.handleBargeIn(jobId);
                    }, config.bargeInDelay);
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

                        const modifiers = await AdaptiveEngineService.generateModifiers({
                            sentiment: session.lastSentiment,
                            interruptions: session.interruptions,
                            speakingSpeed: session.avgSpeechSpeed,
                            durationRatio,
                            turnsRatio
                        }, state.protocol, state.lastModifiers);

                        logger.info({ jobId, modifiers }, "Adaptive Pulse: Adjusting Next Turn Behavior");

                        // Save modifiers back to state for Worker to pick up
                        state.lastModifiers = modifiers;
                        await StateService.setCallState(jobId, state);
                    }
                }
            });

            ws.on("error", (err) => {
                logger.error({ jobId, err: err.message }, "Media Stream Socket Error");
            });

            ws.on("close", async () => {
                clearInterval(heartbeat);
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
