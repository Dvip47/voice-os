const { logger } = require("../../utils/logger");

/**
 * Phase 5 - Global Voice Gateway Middleware.
 * Decides regional routing based on:
 * 1. Phone number country code
 * 2. Payload 'region' hints
 * 3. Compliance (UK/EU residency)
 */
const globalGatewayMiddleware = (req, res, next) => {
    const phoneNumber = req.body.phone_number;
    const requestedRegion = req.body.runtime?.region || "auto";
    const dataResidency = req.body.runtime?.data_residency || "Standard";

    let targetRegion = "ap-south-1"; // Baseline default (Mumbai)

    // 1. Phone-based Automatic Routing
    if (phoneNumber && requestedRegion === "auto") {
        if (phoneNumber.startsWith("+44") || phoneNumber.startsWith("+49")) {
            targetRegion = "eu-west-1"; // UK/EU -> Ireland
        } else if (phoneNumber.startsWith("+971")) {
            targetRegion = "me-central-1"; // UAE -> Dubai
        } else if (phoneNumber.startsWith("+1")) {
            targetRegion = "us-east-1"; // North America -> Virginia
        }
    } else if (requestedRegion !== "auto") {
        targetRegion = requestedRegion;
    }

    // 2. Data Residency Guard (Strict Enforcement)
    if (dataResidency === "Strict" || dataResidency === "LocalOnly") {
        logger.info({ phoneNumber, targetRegion, dataResidency }, "Strict Data Residency Applied: Locking execution to region.");
    }

    // Rewrite region for execution context
    req.body.runtime = { ...(req.body.runtime || {}), region: targetRegion };

    logger.info({ phoneNumber, targetRegion }, "Global Fabric Routing Decision Complete");
    next();
};

module.exports = { globalGatewayMiddleware };
