/**
 * The one place Chrome is launched.
 *
 * 🔴 `puppeteer.launch({ headless: true })` DOES NOT WORK ON A GITHUB RUNNER.
 * Chrome's own sandbox needs unprivileged user namespaces, and Ubuntu 23.10+
 * restricts those through AppArmor. The browser aborts before it opens a page:
 *
 *   FATAL: No usable sandbox! If you are running on Ubuntu 23.10+ ...
 *   Failed to launch the browser process
 *
 * That is what the first live syndication run died on — after the workflow was
 * resumed, after the browser installed cleanly, one step before anything would
 * have posted. Nothing reached a channel and the ledger was untouched, which is
 * the failure behaving correctly; but the card never drew.
 *
 * `test/utils/helpers.mjs` has passed these flags since the scene tests were
 * written, which is exactly why scene-ci.yml boots a real Chrome on the same
 * image and has never failed this way. The knowledge existed in the repo and
 * had not reached the renderer.
 *
 * ── ON DISABLING THE SANDBOX ─────────────────────────────────────────────────
 * It is a real reduction in isolation and it is the accepted trade for CI. The
 * sandbox protects the host from hostile page content; this browser opens local
 * HTML this repo generated, on a disposable runner, and closes. There is no
 * untrusted content in the loop. The alternative is re-enabling user namespaces
 * on the runner, which needs root — the exact privilege the last failure was
 * about.
 *
 * `--disable-web-security` is deliberately NOT here. The scene tests carry it to
 * get CORS out of the way against a dev server; card rendering has no such need,
 * and a flag that is load-bearing in one place is not therefore harmless in
 * another.
 */
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";

/** Flags a headless Chrome needs to start on a GitHub runner. */
export const RUNNER_SAFE_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

export function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    ...options,
    args: [...RUNNER_SAFE_ARGS, ...(options.args ?? [])],
  });
}
