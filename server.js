const express = require("express");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// === Middlewares ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === File Upload Setup ===
const upload = multer({ dest: "cookies/" });

// === SSE Clients ===
const clients = new Set();
function sendLog(type, text) {
  const data = `data: ${JSON.stringify({ ts: Date.now(), type, text })}\n\n`;
  for (const res of clients) {
    res.write(data);
  }
}
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  clients.add(res);
  sendLog("info", "SSE connected ✅");
  req.on("close", () => clients.delete(res));
});

// === Utils ===
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// === Report Flow ===
async function reportFlow(page, url, reason) {
  try {
    sendLog("info", `➡️ Visiting ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await sleep(3000);

    // ⚠️ এখানে সঠিক selector বসাতে হবে
    await page.click('text="Report"');
    await sleep(1000);
    await page.click(`text="${reason}"`);
    await sleep(1000);
    await page.click('text="Submit"');
    await sleep(2000);

    sendLog("success", `✔ Report submitted for ${reason}`);
    return true;
  } catch (e) {
    sendLog("error", `❌ Failed: ${e.message}`);
    return false;
  }
}

// === Main Runner ===
async function runReports(cookieFiles, targetUrl, reason) {
  sendLog("info", `🚀 Running job with ${cookieFiles.length} accounts...`);

  for (const file of cookieFiles) {
    sendLog("info", `🔑 Using account: ${path.basename(file)}`);
    try {
      const browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();

      // load cookies
      const cookies = JSON.parse(fs.readFileSync(file, "utf-8"));
      for (let c of cookies) await page.setCookie(c);

      const ok = await reportFlow(page, targetUrl, reason);

      if (ok) {
        sendLog("success", `Done with ${path.basename(file)}`);
      } else {
        sendLog("warn", `Skipped ${path.basename(file)}`);
      }

      await browser.close();
    } catch (err) {
      sendLog("error", `Browser failed: ${err.message}`);
    }
    await sleep(3000);
  }

  sendLog("info", "🎯 Job finished!");
}

// === Start Job ===
app.post("/start-report", upload.array("cookies"), async (req, res) => {
  const { targetUrl, reason } = req.body;
  if (!targetUrl || !reason) {
    return res.status(400).json({ ok: false, message: "targetUrl & reason required" });
  }

  const cookieFiles = req.files.map((f) => f.path);
  if (!cookieFiles.length) {
    return res.status(400).json({ ok: false, message: "No cookies uploaded" });
  }

  res.json({ ok: true, message: "Job started" });
  runReports(cookieFiles, targetUrl, reason);
});

// === Stop Job (future expand, abort flag) ===
app.post("/stop-report", (req, res) => {
  sendLog("warn", "⛔ Stop requested (not implemented yet)");
  res.json({ ok: true });
});

// === Health ===
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// === Boot ===
app.listen(PORT, () => console.log(`⚡ Server at http://localhost:${PORT}`));

// === Crash Safe ===
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({ ok: false, message: err.message || "Server error" });
});
process.on("unhandledRejection", (r) => console.error("❌ Rejection:", r));
process.on("uncaughtException", (e) => console.error("❌ Exception:", e));
