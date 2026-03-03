const express = require("express");
const router = express.Router();
const twilio = require("twilio");

router.post("/v1/twilio/test-voice", (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    twiml.say(
        {
            voice: "Polly.Aditi",
            language: "en-IN",
        },
        `
Hello. This is a test call from Universal Voice Runtime.
This call is running in production mode.
I am speaking using an Indian English neural voice.

We are testing audio clarity, pacing, tone projection, and telephony latency.

If you can hear this message clearly, the voice infrastructure is working correctly.

This message will continue for a few seconds to help evaluate natural flow and pronunciation.

Thank you for participating in this test.
Goodbye.
`
    );

    res.type("text/xml");
    res.send(twiml.toString());
});

module.exports = router;
