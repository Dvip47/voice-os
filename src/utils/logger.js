const pino = require("pino");
const redactPII = (val) => {
  if (typeof val !== "string") return val;
  return val
    .replace(/[\w\.-]+@[\w\.-]+\.\w{2,4}/gi, "[EMAIL_REDACTED]")
    .replace(/\+?\d{10,15}/g, "[PHONE_REDACTED]")
    .replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, "[CC_REDACTED]");
};

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["email", "phone", "phone_number", "apiKey", "auth_token", "signing_secret"],
    censor: "[REDACTED]"
  },
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

module.exports = { logger, redactPII };
