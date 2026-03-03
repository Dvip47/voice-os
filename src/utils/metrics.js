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

// Phase 6 - India SLA Dashboard Metrics
const call_success_rate = new client.Gauge({
    name: "voice_runtime_call_success_rate",
    help: "Percentage of calls reaching success condition",
    labelNames: ["region"]
});

const call_connect_rate = new client.Gauge({
    name: "voice_runtime_call_connect_rate",
    help: "Percentage of initiated calls that connected",
    labelNames: ["carrier"]
});

const avg_answer_time = new client.Histogram({
    name: "voice_runtime_answer_time_ms",
    help: "Time from initiation to answer",
    labelNames: ["region"],
    buckets: [500, 1000, 2000, 5000, 10000]
});

const webhook_delivery_rate = new client.Gauge({
    name: "voice_runtime_webhook_delivery_rate",
    help: "Success rate of client callbacks",
    labelNames: ["tenant"]
});

const carrier_failure_rate = new client.Counter({
    name: "voice_runtime_carrier_failures_total",
    help: "Total telephony/PSTN level failures",
    labelNames: ["region", "error_type"]
});

module.exports = {
    register: client.register,
    metrics: {
        llm_latency,
        tts_latency,
        stt_latency,
        call_duration,
        active_calls,
        total_calls,
        call_success_rate,
        call_connect_rate,
        avg_answer_time,
        webhook_delivery_rate,
        carrier_failure_rate
    }
};
