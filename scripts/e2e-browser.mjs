// Browser end-to-end checks for solun, driven by scripts/e2e-local.sh.
// Env: WEB_URL, FILE_ID (quick file already uploaded), ORIGINAL_FILE (path for hash compare),
//      PW_CORE (path to playwright-core), CHROMIUM (path to chromium binary).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const { chromium } = await import(process.env.PW_CORE + "/index.mjs");
const W = process.env.WEB_URL ?? "http://localhost:3000";
const FID = process.env.FILE_ID;
const ORIGINAL = process.env.ORIGINAL_FILE;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) failed++; };

async function createPaste(mode, text) {
  await page.goto(W + "/", { waitUntil: "networkidle" });
  if (mode === "secure") await page.getByRole("button", { name: "Secure", exact: true }).first().click();
  await page.locator("textarea").first().fill(text);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const link = page.getByText(new RegExp(`${W.replace(/[./]/g, "\\$&")}/(p|s)/`)).first();
  await link.waitFor({ timeout: 15000 });
  return (await link.textContent()).trim();
}

try {
  // Quick paste: create, SSR must not burn, reveal, second visit is gone.
  const qText = "browser quick " + Date.now();
  const qUrl = await createPaste("quick", qText);
  check("quick: link created", /\/p\/\w+$/.test(qUrl));
  await page.goto(qUrl, { waitUntil: "networkidle" });
  check("quick: received-message UI", await page.getByText("You received a message").isVisible());
  await page.getByRole("button", { name: "Reveal message" }).click();
  await page.locator("textarea").first().waitFor({ timeout: 10000 });
  check("quick: revealed content matches", (await page.locator("textarea").first().inputValue()) === qText);
  await page.goto(qUrl, { waitUntil: "networkidle" });
  check("quick: burned after reveal", await page.getByText("Message not found").first().isVisible());

  // Secure paste: key lives in the URL fragment, decrypts in the browser.
  const sText = "browser secure " + Date.now();
  const sUrl = await createPaste("secure", sText);
  check("secure: link has #key fragment", /\/s\/\w+#key=.+/.test(sUrl));
  await page.goto(sUrl, { waitUntil: "networkidle" });
  const decrypt = page.getByRole("button", { name: "Decrypt" });
  await decrypt.waitFor({ timeout: 10000 });
  await decrypt.click();
  await page.locator("textarea").first().waitFor({ timeout: 10000 });
  check("secure: decrypted content matches", (await page.locator("textarea").first().inputValue()) === sText);

  // Quick file: load metadata, decrypt chunks, download, compare hash.
  if (FID && ORIGINAL) {
    await page.goto(W + "/f/" + FID, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /load file/i }).click();
    await page.getByText(/^Ready\.$/).first().waitFor({ timeout: 30000 });
    const download = page.waitForEvent("download", { timeout: 15000 });
    await page.getByRole("button", { name: /download/i }).first().click();
    const d = await download;
    const target = ORIGINAL + ".downloaded";
    await d.saveAs(target);
    const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
    check("file: downloaded file matches original (sha256)", sha(target) === sha(ORIGINAL));
  } else {
    check("file: FILE_ID/ORIGINAL_FILE provided", false);
  }

  // Not-found state.
  await page.goto(W + "/p/nope1234", { waitUntil: "networkidle" });
  check("notfound: /p/nope1234 renders not-found", await page.getByText("Message not found").first().isVisible());
} catch (e) {
  console.log("FAIL exception: " + String(e).split("\n")[0]);
  failed++;
} finally {
  await browser.close();
}

// ERR_ABORTED = cancelled RSC prefetches on navigation; the 404 is the client-side
// HEAD probe on the not-found page. Both are expected.
const real = errors.filter((e) => !/ERR_ABORTED|status of 404/.test(e));
console.log("browser errors:", real.length ? "\n" + real.join("\n") : "none");
if (real.length) failed++;
process.exit(failed ? 1 : 0);
