require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const from = process.env.TWILIO_PHONE_NUMBER || '+15316253237';
const to = process.argv[2] || '+919616253237';
const url = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/v1/twilio/test-voice` : 'https://voice.dailyexamresult.com/v1/twilio/test-voice';

console.log(`🚀 Initiating Twilio Outbound Call...`);
console.log(`From: ${from}`);
console.log(`To: ${to}`);
console.log(`Webhook URL: ${url}`);

client.calls
    .create({
        url: url,
        to: to,
        from: from
    })
    .then(call => {
        console.log(`✅ Call successfully initiated!`);
        console.log(`Call SID: ${call.sid}`);
    })
    .catch(err => {
        console.error(`❌ Failed to initiate call:`, err.message);
        process.exit(1);
    });
