const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// === Utils ===
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// === Load Cookies ===
async function loadCookies(page, cookieFile) {
  if (fs.existsSync(cookieFile)) {
    const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf-8"));
    for (let cookie of cookies) {
      await page.setCookie(cookie);
    }
    console.log(`✅ Cookies loaded for ${cookieFile}`);
  } else {
    console.log(`⚠️ No cookie file: ${cookieFile}`);
  }
}

// === Save Cookies ===
async function saveCookies(page, cookieFile) {
  const cookies = await page.cookies();
  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
  console.log(`💾 Cookies saved: ${cookieFile}`);
}

// === Report Flow (তুই এখানে নিজের selector বসাবি) ===
async function reportPost(page, postUrl) {
  console.log(`➡️ Visiting ${postUrl}`);
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });
  await sleep(2000);

  // Example → report menu open (⚠️ এখানে তোর সঠিক selector লাগবে)
  try {
    await page.click('text="Report post"');
    await sleep(1000);

    // Example → abusive reason select (⚠️ এখানে তোর selector লাগবে)
    await page.click('text="Abusive"');
    await sleep(1000);

    // Example → confirm
    await page.click('text="Submit"');
    await sleep(2000);

    console.log("✔ Report submitted!");
    return true;
  } catch (e) {
    console.log("❌ Report failed:", e.message);
    return false;
  }
}

// === Use One Account ===
async function useAccount(cookieFile, postUrl) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Load cookies
  await loadCookies(page, cookieFile);

  // Visit post & report
  const ok = await reportPost(page, postUrl);

  // Save cookies back (refresh session)
  await saveCookies(page, cookieFile);

  await browser.close();
  return ok;
}

// === MAIN ===
(async () => {
  const postUrl = "https://www.facebook.com/123456789/posts/987654321"; // Target Post
  const accountsDir = path.join(__dirname, "cookies");
  const cookieFiles = fs.readdirSync(accountsDir).map(f => path.join(accountsDir, f));

  console.log(`🚀 Starting job with ${cookieFiles.length} accounts...`);

  for (const file of cookieFiles) {
    console.log(`\n=== Using account: ${file} ===`);
    const result = await useAccount(file, postUrl);
    console.log(result ? "✅ Success" : "❌ Failed");
    await sleep(3000); // ছোট gap (bot detection avoid)
  }

  console.log("🎯 Job finished!");
})();
