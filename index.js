require("./config/db.config");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const express = require("express");
const router = require("./router");
const config = require("./config/config");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const http = require("http");
const server = http.createServer(app);

// Log file setup
const logFilePath = path.join(__dirname, "logs", "server.log");
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

// Morgan logging setup
app.use(morgan("combined", { stream: logStream }));

// Middleware and routing
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/", router);

app.use((req, res) => {
    res.type("text/plain");
    res.status(404).send({ success: true, message: "Server is Working." });
});

// Periodic file integrity check
const hashFile = (filePath) => {
    const fileData = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(fileData).digest("hex");
};

const monitorFileIntegrity = () => {
    let previousHash = hashFile(logFilePath);
    setInterval(() => {
        const currentHash = hashFile(logFilePath);
        if (currentHash !== previousHash) {
            console.error("Log file integrity compromised!");
            previousHash = currentHash;
        }
    }, 60000); // Run every 1 minute
};

// Failed attempt tracking
// const failedAttempts = new Map();
// const ALERT_THRESHOLD = 5; // Number of failed attempts
// const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// const trackFailedAttempts = (ip) => {
//     const now = Date.now();
//     const attempts = failedAttempts.get(ip) || [];
//     const recentAttempts = attempts.filter((time) => now - time < LOCKOUT_TIME);

//     recentAttempts.push(now);
//     failedAttempts.set(ip, recentAttempts);

//     if (recentAttempts.length >= ALERT_THRESHOLD) {
//         console.error(`Alert: Multiple failed attempts detected from IP: ${ip}`);
//         failedAttempts.set(ip, [...recentAttempts, now + LOCKOUT_TIME]); // Extend lockout
//     }
// };

app.use((req, res, next) => {
    const ip = req.ip;

    // Simulating failed login detection (update this based on actual logic)
    if (req.path === "/login" && req.method === "POST" && req.body.failed) {
        trackFailedAttempts(ip);
    }

    // Block requests from locked-out IPs
    const attempts = failedAttempts.get(ip) || [];
    if (attempts.length && Date.now() < attempts[attempts.length - 1]) {
        return res.status(429).send("Too many failed attempts. Try again later.");
    }

    next();
});

// Start server and monitor integrity
server.listen(config.PORT, () => {
    console.log(`App running on http://localhost:${config.PORT}`);
    monitorFileIntegrity();
});
