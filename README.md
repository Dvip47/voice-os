# Universal Voice Runtime (UVR)
### Programmable Voice Execution Infrastructure

The **Universal Voice Runtime** is a distributed, multi-region voice compute layer designed for high-concurrency, autonomous voice interactions. Unlike traditional IVR systems or scripted chatbots, UVR operates on a **Behavioral Contract Model**, allowing for dynamic, real-time modulation of agent behavior, tone, and strategy based on live acoustic and semantic signals.

---

## 🏗️ Architecture Overview

The system is decoupled into independent, horizontally scalable clusters managed via a centralized Redis Distributed State Store.

```text
                                [ API GATEWAY ]
                                       │
                        ┌──────────────┴──────────────┐
                 [ API NODES ]                  [ PROMETHEUS ]
                (Rate Isolation)               (Observability)
                        │                              │
                [ REDIS / BULLMQ ] <───────────────────┘
               (Job Queue & State)
                        │
          ┌─────────────┴─────────────┐
 [ WORKER NODES ]              [ MEDIA NODES ]
 (Call Orchestration)         (WebSocket Audio)
          │                           │
          │                   [ SIGNAL EXTRACTOR ]
          │                   (Sentiment/Engagement)
          │                           │
 [ LLM ROUTER ] <────────────── [ ADAPTIVE ENGINE ]
 (Cost/Latency Aware)         (Behavioral Modulation)
          │
 [ PERSISTENCE ]
 (Postgres/S3)
```

---

## 🧠 Philosophy: The Behavioral Contract Model

UVR introduces the **Safe Behavioral Execution Contract (SBEC)**. Instead of hard-coding dialogue trees, clients submit a pure behavioral protocol. The runtime's **Context Compiler** transforms this JSON protocol into a deterministic execution environment with strict boundary enforcement.

**Key Principles:**
- **Domain Neutrality:** The runtime has no innate knowledge of the business vertical.
- **Stateless Execution:** API nodes are stateless; call state is persisted in the distributed mesh.
- **Adaptive Perception:** Behavior evolves *during* the call based on user signals.

---

## 📜 Protocol Specification (v1.1)

Execution is triggered by a POST to `/v1/call/execute` with a protocol-compliant payload.

```json
{
  "protocol_version": "1.1",
  "phone_number": "+9198XXXXXXXX",
  "agent": {
    "name": "AgentAlpha",
    "role": "DomainSpecialist",
    "authority_level": "Standard"
  },
  "conversation": {
    "language": "English",
    "tone": "Balanced",
    "style": "Concise",
    "reasoning_depth": 7,
    "behavioral_profile": {
      "verbosity": 0.6,
      "directness": 0.8,
      "authority_projection": 0.7
    },
    "max_turns": 15
  },
  "runtime": {
    "region": "ap-south-1",
    "data_residency": "Strict",
    "latency_target_ms": 1200
  }
}
```

---

## 🚀 Key Modules

### 1. Global Gateway & Rate Isolation
Implements per-tenant RPM and concurrency limits using Redis atomic counters. It performs **Region-Aware Routing**, choosing the nearest execution cluster based on country code or explicit residency requirements.

### 2. Context Compiler (SBEC)
A security-first transformation layer that sanitizes payloads, prevents prompt injection, and compiles high-level behavior into a structured, block-based system prompt for the execution model.

### 3. Adaptive Intelligence Engine
Senses real-time signals (sentiment, interruptions, silence) and modulates the runtime parameters (TTS rate, pitch, response verbosity) mid-call based on **Behavioral Geometry**.

### 4. Global Intelligence Loop (Autonomous)
Observes patterns across thousands of calls. If a specific behavior correlates with failure, the **Global Optimizer** autonomously refines the behavioral constants (e.g., lowering interruption thresholds) for future sessions.

### 5. Cognitive-Load LLM Router
Dynamically routes requests between Gemini, GPT-4o-mini, and Claude-3-Haiku based on the **Reasoning Depth** vs. the user's latency target.

---

## 🛠️ Deployment & Execution

### Folder Structure
```text
├── src/
│   ├── api/             # Express handlers & Isolation middleware
│   ├── core/            # SBEC Compiler, Adaptive Engine, LLM Router
│   ├── media-server/    # WebSocket audio & Signal extraction
│   ├── intelligence/    # Global pattern optimizer
│   ├── workers/         # BullMQ orchestration
│   ├── queue/           # Redis connection logic
│   └── utils/           # Observability (Prometheus) & Logger
├── Dockerfile           # Multi-stage production build
└── docker-compose.yml   # Multi-region cluster orchestration
```

### Quick Start (Development)
```bash
# 1. Setup Redis & Variables
export REDIS_URL=redis://localhost:6379

# 2. Install & Start
npm install
npm run dev

# 3. Trigger Execution
curl -X POST http://localhost:4000/v1/call/execute \
     -H "x-api-key: your_key" \
     -H "Content-Type: application/json" \
     -d '{...protocol_payload...}'
```

---

## 🛡️ Security & Observability

- **Injection Defense:** Strict regex-based scrubbers for "ignore previous instructions" patterns.
- **Data Residency:** Support for `LocalOnly` execution where audio packets and state never leave the regional VPC.
- **Metrics:** Native Prometheus metrics on `:4000/metrics` tracking `llm_latency`, `active_calls`, and `stt_accuracy`.

---

## ⚖️ Differentiators

| Feature | Standard AI Chatbot | **Universal Voice Runtime** |
| :--- | :--- | :--- |
| **Logic** | Static Logic/State | Dynamic Behavioral Contract |
| **Pacing** | Fixed Turn Delay | Adaptive Pacing & TTS Modulation |
| **Scaling** | Single Instance | Distributed Global Fabric |
| **Evolution** | Manual Updates | Autonomous Intelligence Loop |
| **Architecture** | Product-bound | Infrastructure-Programmable |

---

## 📊 Performance Targets
- **Interactive Latency:** < 1.5s (P95)
- **Concurrent Capacity:** 1,000+ per cluster
- **Barge-in Latency:** < 300ms
# voice-os
# voice-os
