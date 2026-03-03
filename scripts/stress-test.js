const http = require('http');

const API_URL = 'http://localhost:4000/v1/call/execute';
const API_KEY = '21fef161ef71f8bdb92cdea2a90da59fb17d52c1eb7056fc0e2f28a8712d6e8f';

const payload = JSON.stringify({
    protocol_version: '1.1',
    phone_number: '+919999999999',
    agent: {
        name: 'StressTester',
        role: 'ChaosAgent'
    },
    knowledge: {
        scope: 'General tech support and chaos simulation parameters.'
    },
    conversation: {
        language: 'English',
        reasoning_depth: 7,
        behavioral_profile: {
            verbosity: 0.6,
            directness: 0.8
        }
    },
    objective: {
        primary_goal: 'Test system resilience under load.'
    }
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(payload)
    }
};

let successCount = 0;
let errorCount = 0;
let activeRequests = 0;

function sendRequest() {
    activeRequests++;
    const req = http.request(API_URL, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 202) {
                successCount++;
            } else {
                errorCount++;
                // console.error(`Error: ${res.statusCode} - ${data}`);
            }
            activeRequests--;
        });
    });

    req.on('error', (e) => {
        errorCount++;
        activeRequests--;
        // console.error(`Request Error: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

console.log("🚀 Starting Node.js Native Stress Test...");
console.log(`Target: ${API_URL}`);

let currentConcurrency = 10;
const targetConcurrency = 200;
const rampInterval = 5000; // Ramp up every 5s

const statsInterval = setInterval(() => {
    console.log(`[STATS] Concurrency: ${currentConcurrency} | Successes: ${successCount} | Errors: ${errorCount} | Active Req: ${activeRequests}`);
}, 2000);

const stressInterval = setInterval(() => {
    if (activeRequests < currentConcurrency) {
        for (let i = 0; i < (currentConcurrency - activeRequests); i++) {
            sendRequest();
        }
    }
}, 100);

const rampUpInterval = setInterval(() => {
    if (currentConcurrency < targetConcurrency) {
        currentConcurrency += 20;
        console.log(`⬆️ Ramping up concurrency to ${currentConcurrency}...`);
    } else {
        clearInterval(rampUpInterval);
        console.log("✅ Peak concurrency reached.");
    }
}, rampInterval);

// Stop after 30 minutes (per plan) or Ctrl+C
setTimeout(() => {
    console.log("🏁 Stress Test Complete.");
    process.exit(0);
}, 30 * 60 * 1000);
