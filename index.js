require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { logger } = require("./src/utils/logger");
const v1Routes = require("./src/api/routes/v1.routes");
const { mediaStreamServer } = require("./src/media-server/stream.server");
const { rateIsolationMiddleware } = require("./src/api/middleware/isolation");
const { register } = require("./src/utils/metrics"); // Import Prometheus metrics
const { globalGatewayMiddleware } = require("./src/api/middleware/gateway"); // Regional routing gateway
const http = require("http");

// Startup Components
const { callWorker } = require("./src/workers/call.worker");
const { redisConnection } = require("./src/queue/bullmq.setup");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Production Hardening: TCP & Connection Management
server.headersTimeout = 10000; // 10s
server.requestTimeout = 15000; // 15s
server.keepAliveTimeout = 65000; // Ensure it is greater than LB timeout (e.g. ALBs)

// Higher socket pool for high-concurrency LLM/STT/TTS API calls
require("http").globalAgent.maxSockets = 1000;
require("https").globalAgent.maxSockets = 1000;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
// app.use(limiter);

// Routing
app.use("/v1", rateIsolationMiddleware, globalGatewayMiddleware, v1Routes);

// Health Check & Prometheus Metrics
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        redis: redisConnection.status,
        active_runtime_streams: mediaStreamServer.metrics.activeCalls
    });
});

app.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});

/**
 * Universal Voice Runtime Cluster Bootstrap
 */
server.listen(PORT, () => {
    // Init Media Stream WebSocket Server on Shared Port
    mediaStreamServer.init(server);

    const START_WORKER = process.env.START_WORKER !== "false";
    logger.info({ PORT, START_WORKER }, `Voice Runtime Cluster Bootstrapped`);

    if (START_WORKER) {
        logger.info(`Call Worker Group Monitoring 'outbound-call-queue'`);

        // Phase 6 - Self-Evolving Autonomous Loop
        const { GlobalOptimizerService } = require("./src/intelligence/globalOptimizer.service");
        setInterval(() => {
            GlobalOptimizerService.evolveGlobalRules().catch(err => logger.error({ err }, "Self-Evolution Failed"));
        }, 5 * 60 * 1000); // 5-minute evolution cycle for demo
        logger.info("Autonomous Intelligence Loop: Active & Self-Evolving.");
    } else {
        logger.warn(`API-Only Node: Job monitoring disabled locally.`);
    }
});

// Error Handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: "Something broke!" });
});
