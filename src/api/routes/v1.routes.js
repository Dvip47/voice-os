const express = require("express");
const { CallController } = require("../controllers/call.controller");
const { authenticateApiKey, validateCallRequest } = require("../middleware/security");

const router = express.Router();

/**
 * Universal Voice Execution Phase 1 Routes.
 */

// POST /v1/call/execute
router.post(
    "/call/execute",
    authenticateApiKey,
    validateCallRequest,
    CallController.execute
);

/**
 * Twilio Voice Webhook (TwiML Generator)
 * Entry point for Twilio to start a WebSocket Media Stream.
 */
router.post("/twilio/voice", (req, res) => {
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const domain = publicBaseUrl.replace("https://", "").replace("http://", "");

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://${domain}/v1/call/stream" />
    </Connect>
</Response>`;

    res.type("text/xml");
    res.send(twiml);
});

module.exports = router;
