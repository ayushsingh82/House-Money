/**
 * Browser test of the UI in real Chrome: plays the run, clicks every button, checks every page.
 *   npm run build && npm run e2e
 * Starts `next start` itself on E2E_PORT (default 3112) and stops it afterwards.
 */
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

const port = process.env.E2E_PORT ?? "3112";
const base = `http://localhost:${port}`;
const server = spawn("npx", ["next", "start", "-p", port], { stdio: "ignore" });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

let failures = 0;
const check = (ok: boolean, name: string) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures++;
};
const visible = async (page: Page, text: string | RegExp, timeout = 15_000) => {
  try {
    await page.getByText(text).first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
};

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

console.log("Landing page");
await page.goto(base);
check(await visible(page, "Bank the principal. Trade the house's money."), "hero headline");
check(await visible(page, "One destination"), "floating policy cards");
// Chrome normalises oklch() to lab(), so check the hue (orange is roughly 30-60 degrees) instead of the text.
const accent = await page.evaluate(() => {
  const el = document.createElement("i");
  el.style.color = "var(--accent)";
  document.body.append(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return c;
});
const lab = accent.match(/lab\(([\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)/);
const hue = lab ? (Math.atan2(Number(lab[3]), Number(lab[2])) * 180) / Math.PI : NaN;
check(hue > 30 && hue < 60, `accent is orange (hue ${hue.toFixed(0)}°, ${accent})`);

console.log("\nLive simulation (autoplay)");
await page.getByRole("link", { name: "Watch it run" }).first().click();
check(await visible(page, "Live Simulation"), "dashboard opens");
check(await visible(page, "Settled", 30_000), "run reaches Settled");
check(await visible(page, "1,000.00"), "banked shows 1,000.00");
check(await visible(page, "Principal settled to the safe account."), "settlement in the event feed");
check(await visible(page, "step 55 / 55"), "all 55 steps played");

console.log("\nTry to Break It (client-side navigation keeps the finished run)");
await page.getByRole("link", { name: "Try to Break It" }).click();
for (const [button, code] of [
  ["Give me my money back", "policy_action_denied"],
  ["Withdraw to another address", "policy_destination_denied"],
  ["Withdraw principal + 1", "policy_limit_exceeded"],
] as const) {
  await page.getByRole("button", { name: button }).click();
  check(await visible(page, `refused: ${code}`, 5_000), `${button} -> ${code}`);
}
await page.getByRole("button", { name: "Run all checks" }).click();
check(await visible(page, "9 / 9 held", 5_000), "refusal matrix 9 / 9 held");

console.log("\nSigned Policy and Event Log");
await page.getByRole("link", { name: "Signed Policy" }).click();
check(await visible(page, "30s veto window"), "policy card shows the delay");
check(await visible(page, '"timelock_ms": 30000'), "policy JSON shown");
await page.getByRole("link", { name: "Event Log" }).click();
check(await visible(page, "Gains cover the principal"), "event log lists the trigger");

console.log("\nOwner veto");
await page.goto(`${base}/dashboard`);
await page.getByRole("button", { name: "12×" }).click();
await page.getByRole("button", { name: "Start" }).click();
const veto = page.getByRole("button", { name: "Owner veto: cancel exit" });
await veto.waitFor({ state: "visible", timeout: 20_000 });
await veto.click();
check(await visible(page, /Exit did not settle/, 20_000), "cancelled exit is reported, nothing settles");
await page.waitForTimeout(500);
check((await page.getByText("Principal settled to the safe account.").count()) === 0, "no settlement after the veto");

console.log("\nReset");
await page.getByRole("button", { name: "Reset" }).click();
check(await visible(page, "Waiting for gains…"), "reset clears the run");

check(errors.length === 0, `no uncaught page errors${errors.length ? `: ${errors[0]}` : ""}`);
await page.screenshot({ path: process.env.E2E_SHOT ?? join(tmpdir(), "house-money-e2e.png") }).catch(() => {});
await browser.close();
stop();
console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
