const twilio = require("twilio");
const { logger } = require("../utils/logger");

class TwilioService {
    constructor() {
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }

    /**
     * Triggers a programmable voice call with Media Stream.
     * @param {string} to - Destination number.
     * @param {string} host - Webhook host URL.
     * @param {string} jobId - Associated JOB ID.
     */
    async initiateCall(to, host, jobId) {
        const from = process.env.TWILIO_PHONE_NUMBER;
        const websocketUrl = `wss://${host}/v1/call/stream?job_id=${jobId}`;

        // TwiML for dynamic media streaming
        const twiml = `
      <Response>
        <Connect>
          <Stream url="${websocketUrl}" />
        </Connect>
      </Response>
    `.trim();

        try {
            logger.info({ to, jobId }, "Connecting Twilio to Runtime Worker...");
            const call = await this.client.calls.create({
                from,
                to,
                twiml,
            });

            return call.sid;
        } catch (err) {
            logger.error({ err: err.message, to }, "Twilio Service Initiation Error");
            throw err;
        }
    }
}

module.exports = { twilioService: new TwilioService() };
