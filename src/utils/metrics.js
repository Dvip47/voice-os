const client = require("prom-client");

// Collect default metrics (CPU, Memory, Event Loop)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: "voice_runtime_" });

/**
 * Phase 3 - Voice Compute Observability Layer
 * Prometheus metrics for latency and system throughput.
 */

// Latency Histograms (Performance moats)
const llm_latency = new client.Histogram({
    name: "voice_runtime_llm_latency_ms",
    help: "LLM generation latency in milliseconds",
    labelNames: ["tenant", "model"],
    buckets: [100, 500, 1000, 1500, 2000, 3000, 5000]
});

const tts_latency = new client.Histogram({
    name: "voice_runtime_tts_latency_ms",
    help: "TTS synthesis latency in milliseconds",
    labelNames: ["tenant", "voice"],
    buckets: [50, 100, 250, 500, 1000]
});

const stt_latency = new client.Histogram({
    name: "voice_runtime_stt_latency_ms",
    help: "STT final transcript latency",
    labelNames: ["language"]
});

const call_duration = new client.Histogram({
    name: "voice_runtime_call_duration_seconds",
    help: "Duration of connected voice calls",
    labelNames: ["tenant", "status"]
});

// Throughput Gauges (Capacity Planning)
const active_calls = new client.Gauge({
    name: "voice_runtime_active_calls",
    help: "Number of currently active media streams",
    labelNames: ["node"]
});

// Counters (Billing & Quota)
const total_calls = new client.Counter({
    name: "voice_runtime_calls_total",
    help: "Total calls initiated through the runtime",
    labelNames: ["tenant", "mode"]
});

module.exports = {
    register: client.register,
    metrics: {
        llm_latency,
        tts_latency,
        stt_latency,
        call_duration,
        active_calls,
        total_calls
    }
};
