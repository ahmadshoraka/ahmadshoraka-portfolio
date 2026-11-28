import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  locale: "fa-IR",
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const nav = () => page.locator("nav.bottom-nav");

await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("link", { name: "شروع کن" }).click();
await page.waitForURL("**/onboarding");

// #18: clearing numeric input should stay empty, not sticky 0
const age = page.locator("#age");
await age.fill("28");
await age.fill("");
const ageAfterClear = await age.inputValue();
if (ageAfterClear !== "") {
  console.error("FAIL: age input sticky zero/value after clear:", ageAfterClear);
  process.exit(1);
}
await age.fill("28");

await page.getByRole("textbox", { name: "نام" }).fill("آزما");
await page.getByRole("button", { name: "ادامه" }).click();
await page.getByRole("button", { name: "ادامه" }).click();
await page.getByRole("button", { name: "برو به امروز" }).click();
await page.waitForURL("**/today");
await page.screenshot({
  path: path.join(outDir, "vorood-header-today.png"),
  fullPage: true,
});

const headerBox = await page.locator("header.topbar").boundingBox();
if (!headerBox || headerBox.width < 380) {
  console.error("FAIL: header not near full mobile width", headerBox);
  process.exit(1);
}

await nav().getByRole("link", { name: "ثبت غذا" }).click();
await page.waitForURL("**/log");
const eggRow = page.locator(".list-item").filter({ hasText: "تخم‌مرغ" });
await eggRow.getByRole("button", { name: "افزودن" }).click();
await page.waitForURL("**/today");
const eatenText = await page.locator(".stat").nth(1).innerText();
await page.screenshot({
  path: path.join(outDir, "vorood-e2e-after-add.png"),
  fullPage: true,
});

await nav().getByRole("link", { name: "ثبت غذا" }).click();
await page.waitForURL("**/log");
await page.getByRole("tab", { name: "پیشنهاد AI" }).click();
await page.getByText("تازه‌سازی پیشنهادها").waitFor({ timeout: 10000 });
await page.locator(".list-item").first().waitFor({ timeout: 10000 });
await page.screenshot({ path: path.join(outDir, "vorood-e2e-ai.png"), fullPage: true });
const aiOk = (await page.locator(".list-item").count()) > 0;

await nav().getByRole("link", { name: "دستیار" }).click();
await page.waitForURL("**/chat");
await page.getByRole("button", { name: "شام چی بخورم؟" }).click();
await page.locator(".bubble.user").filter({ hasText: "شام چی بخورم؟" }).waitFor({ timeout: 5000 });
await page
  .locator(".bubble.assistant")
  .filter({ hasText: "کالری" })
  .waitFor({ timeout: 10000 });
await page.screenshot({ path: path.join(outDir, "vorood-e2e-chat.png"), fullPage: true });
const bubbles = await page.locator(".bubble.assistant").count();

const result = {
  ageAfterClear,
  headerWidth: headerBox.width,
  eatenText,
  aiOk,
  assistantBubbles: bubbles,
  pageErrors: errors,
};
console.log(JSON.stringify(result, null, 2));
if (!eatenText.includes("۷۸") && !eatenText.includes("78")) {
  console.error("FAIL: egg calories not reflected");
  process.exit(1);
}
if (!aiOk || bubbles < 1) {
  console.error("FAIL: AI or chat incomplete");
  process.exit(1);
}
if (errors.length) {
  console.error("FAIL: page errors", errors);
  process.exit(1);
}
await browser.close();
console.log("E2E PASS");
