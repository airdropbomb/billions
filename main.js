const fs = require("fs");
const axios = require("axios");
const moment = require("moment-timezone");
const path = require("path");

const tokenPath = path.join(__dirname, "token.txt");
const proxyPath = path.join(__dirname, "proxy.txt");

// Multiple Tokens ဖတ်ခြင်း
function readSessionTokens() {
    try {
        const data = fs.readFileSync(tokenPath, "utf8").trim().split("\n");
        return data.map(line => {
            const token = line.split("=")[1]?.trim();
            return token ? token : null;
        }).filter(Boolean); // Null ဖယ်ထုတ်ရန်
    } catch (err) {
        console.error("❌ Failed to read token.txt file:", err.message);
        return [];
    }
}

// Proxy ဖတ်ခြင်း (Optional) - URL-style format ကို support လုပ်ရန်
function readProxy() {
    try {
        const data = fs.readFileSync(proxyPath, "utf8").trim();
        const proxyRegex = /^(http|https):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
        const match = data.match(proxyRegex);

        if (!match) {
            console.log("⚠️ Invalid proxy format in proxy.txt. Expected: http://user:pass@host:port");
            return null;
        }

        const [, protocol, username, password, host, port] = match;
        return {
            protocol,
            host,
            port: parseInt(port),
            auth: username && password ? { username, password } : undefined
        };
    } catch (err) {
        console.log("⚠️ No proxy.txt found or invalid format. Running without proxy.");
        return null;
    }
}

const TOKENS = readSessionTokens();
const PROXY_CONFIG = readProxy();

if (!TOKENS.length) {
    console.log("⚠️ No valid tokens found in token.txt.");
    process.exit(1);
}

function getHeaders(sessionId) {
    return {
        "accept": "application/json, text/plain, */*",
        "cookie": `session_id=${sessionId}`,
        "origin": "https://signup.billions.network",
        "referer": "https://signup.billions.network/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    };
}

function showBanner() {
    console.log(`
 █████╗ ██████╗ ██████╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗
██╔══██╗██╔══██╗██╔══██╗    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
███████║██║  ██║██████╔╝    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
██╔══██║██║  ██║██╔══██╗    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
██║  ██║██████╔╝██████╔╝    ██║ ╚████║╚██████╔╝██████╔╝███████╗
╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
by btctrader
    `);
    console.log("🔥 Automating Daily Reward for BILLIONS NETWORK 🔥\n");
}

function formatTime(utcTime) {
    return moment(utcTime).tz("Asia/Jakarta").format("dddd, DD MMMM YYYY, HH:mm:ss [WIB]");
}

function formatRemainingTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    return `${hours} hours ${minutes} minutes ${seconds} seconds`;
}

async function getUserStatus(sessionId) {
    try {
        const response = await axios.get("https://signup-backend.billions.network/me", {
            headers: getHeaders(sessionId),
            ...(PROXY_CONFIG ? { proxy: PROXY_CONFIG } : {}) // Proxy optional
        });
        const data = response.data;

        console.log(`\n👤 [Account: ${data.email}]`);
        console.log(`Name: ${data.name}`);
        console.log(`📩 Email: ${data.email}`);
        console.log(`🆔 ID: ${data.id}`);
        console.log(`🏆 Rank: ${data.rank}`);
        console.log(`🔗 Referral Code: ${data.referralCode}`);
        console.log(`⚡ Power: ${data.power}`);
        console.log(`🎖 Level: ${data.level}`);
        console.log(`🔄 Next Daily Reward At: ${formatTime(data.nextDailyRewardAt)}`);

        return data.nextDailyRewardAt;
    } catch (error) {
        console.error(`❌ Failed to get status for token ${sessionId.slice(0, 10)}...:`, error.response?.data || error.message);
        return null;
    }
}

async function claimDailyReward(sessionId) {
    try {
        const response = await axios.post("https://signup-backend.billions.network/claim-daily-reward", {}, {
            headers: getHeaders(sessionId),
            ...(PROXY_CONFIG ? { proxy: PROXY_CONFIG } : {}) // Proxy optional
        });

        if (response.status === 200) {
            console.log(`✅ [${sessionId.slice(0, 10)}...] Successfully claimed daily reward on ${moment().tz("Asia/Jakarta").format("HH:mm:ss [WIB]")}`);
        } else {
            console.log(`⚠️ [${sessionId.slice(0, 10)}...] Failed to claim daily reward:`, response.data);
        }
    } catch (error) {
        console.error(`❌ [${sessionId.slice(0, 10)}...] Failed to claim daily reward:`, error.response?.data || error.message);
    }
}

async function countdownAndClaim(sessionId, nextClaimTime) {
    let nextClaimTimestamp = moment(nextClaimTime).tz("Asia/Jakarta").valueOf();
    console.log(`⏳ [${sessionId.slice(0, 10)}...] Waiting until: ${formatTime(nextClaimTime)}...`);

    return new Promise(resolve => {
        const interval = setInterval(() => {
            let nowTimestamp = moment().tz("Asia/Jakarta").valueOf();
            let timeUntilClaim = nextClaimTimestamp - nowTimestamp;

            if (timeUntilClaim <= 0) {
                clearInterval(interval);
                console.log(`\n🚀 [${sessionId.slice(0, 10)}...] Time to claim! Sending request...`);
                claimDailyReward(sessionId).then(resolve);
                return;
            }

            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`⏳ [${sessionId.slice(0, 10)}...] ${formatRemainingTime(timeUntilClaim)} left to claim daily`);
        }, 1000);
    });
}

async function processAccount(sessionId) {
    const nextRewardTime = await getUserStatus(sessionId);
    if (!nextRewardTime) return;

    await countdownAndClaim(sessionId, nextRewardTime);
}

async function runForAllAccounts() {
    showBanner();
    console.log(`🔄 Processing ${TOKENS.length} account(s)...`);

    while (true) {
        await Promise.all(TOKENS.map(async (token) => {
            await processAccount(token);
        }));

        console.log("\n🔄 All accounts processed. Waiting for the next cycle (24 hours)...\n");
        await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000)); // Wait 24 hours
    }
}

runForAllAccounts();
