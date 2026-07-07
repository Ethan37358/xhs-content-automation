#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not available. Run `npm install` in xhs-publisher or use a Node runtime with Playwright installed.");
  process.exit(2);
}

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(__dirname, "config.example.json");

const ERROR_CODES = {
  QUEUE_EMPTY: "queue_empty",
  LOGIN_REQUIRED: "login_required",
  CAPTCHA_REQUIRED: "captcha_required",
  CONTENT_INVALID: "content_invalid",
  PUBLISH_UI_CHANGED: "publish_ui_changed",
  PUBLISH_REJECTED: "publish_rejected",
  UNKNOWN: "unknown_error"
};

function nowIso() {
  return new Date().toISOString();
}

function localStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function mergeDeep(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object") {
      out[key] = mergeDeep(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function parseArgs(argv) {
  const args = { command: argv[2] || "help", config: DEFAULT_CONFIG };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") args.config = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--live") args.dryRun = false;
  }
  return args;
}

function loadConfig(args) {
  const base = readJson(DEFAULT_CONFIG);
  const configPath = path.resolve(args.config || DEFAULT_CONFIG);
  const user = configPath === path.resolve(DEFAULT_CONFIG) ? {} : readJson(configPath);
  const config = mergeDeep(base, user);
  if (typeof args.dryRun === "boolean") config.dryRun = args.dryRun;
  config.queueRoot = path.resolve(config.queueRoot);
  config.userDataDir = path.resolve(config.userDataDir);
  config.configPath = configPath;
  return config;
}

function ensureQueue(config) {
  for (const dir of ["pending", "published", "failed", "logs"]) {
    fs.mkdirSync(path.join(config.queueRoot, dir), { recursive: true });
  }
}

function logLine(config, level, event, data = {}) {
  ensureQueue(config);
  const entry = { time: nowIso(), level, event, ...data };
  const line = JSON.stringify(entry);
  fs.appendFileSync(path.join(config.queueRoot, "logs", "publisher.jsonl"), `${line}\n`);
  fs.appendFileSync(path.join(config.queueRoot, "logs", "publisher.log"), `[${entry.time}] ${level.toUpperCase()} ${event} ${JSON.stringify(data)}\n`);
  console.log(line);
}

function pendingItems(config) {
  const dir = path.join(config.queueRoot, "pending");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => path.join(dir, d.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function findImage(itemDir) {
  const names = fs.readdirSync(itemDir);
  const image = names.find((name) => /^image\.(png|jpe?g|webp)$/i.test(name));
  return image ? path.join(itemDir, image) : null;
}

function readContent(itemDir, config) {
  const textPath = path.join(itemDir, "text.md");
  if (!fs.existsSync(textPath)) {
    throw userError(ERROR_CODES.CONTENT_INVALID, "Missing required text.md");
  }
  const text = fs.readFileSync(textPath, "utf8").trim();
  if (!text) throw userError(ERROR_CODES.CONTENT_INVALID, "text.md is empty");

  const imagePath = findImage(itemDir);
  if (config.requireImage && !imagePath) {
    throw userError(ERROR_CODES.CONTENT_INVALID, "Missing required image.png/image.jpg/image.jpeg/image.webp");
  }

  const metaPath = path.join(itemDir, "meta.json");
  const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};
  const promptPath = path.join(itemDir, "image_prompt.txt");
  const imagePrompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8").trim() : "";

  const title = (meta.title || extractTitle(text)).trim();
  let body = stripMarkdownTitle(text);
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const finalTags = tags.length ? tags : (Array.isArray(config.defaultTags) ? config.defaultTags : []);
  if (config.appendTagsToText && finalTags.length) {
    const tagText = finalTags.map((tag) => `#${String(tag).replace(/^#/, "").trim()}`).filter(Boolean).join(" ");
    if (tagText && !body.includes(tagText)) body = `${body}\n\n${tagText}`;
  }

  return { itemDir, textPath, imagePath, metaPath, promptPath, imagePrompt, meta, title, body };
}

function extractTitle(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const h1 = lines.find((line) => line.startsWith("# "));
  if (h1) return h1.replace(/^#\s+/, "").slice(0, 40);
  return (lines[0] || "普通人低能量生活观察").replace(/^#+\s*/, "").slice(0, 40);
}

function stripMarkdownTitle(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] && /^#\s+/.test(lines[0])) return lines.slice(1).join("\n").trim();
  return text.trim();
}

function userError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function moveItem(config, itemDir, state, payload) {
  const sourceName = path.basename(itemDir);
  const suffix = state === "published" ? "published" : "failed";
  const targetName = `${sourceName}__${suffix}_${localStamp()}`;
  const targetDir = path.join(config.queueRoot, state, targetName);
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.renameSync(itemDir, targetDir);
  const resultName = state === "published" ? "published.json" : "failure.json";
  fs.writeFileSync(path.join(targetDir, resultName), JSON.stringify({ time: nowIso(), ...payload }, null, 2));
  return targetDir;
}

async function launch(config) {
  fs.mkdirSync(config.userDataDir, { recursive: true });
  const launchOptions = {
    headless: Boolean(config.headless),
    viewport: { width: 1440, height: 900 },
    acceptDownloads: false,
    args: [
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-features=Crashpad"
    ]
  };
  if (config.browser && config.browser.executablePath) {
    launchOptions.executablePath = config.browser.executablePath;
  }
  if (config.browser && config.browser.homeDir) {
    fs.mkdirSync(config.browser.homeDir, { recursive: true });
    launchOptions.env = { ...process.env, HOME: config.browser.homeDir };
  }
  const context = await chromium.launchPersistentContext(config.userDataDir, {
    ...launchOptions
  });
  context.setDefaultTimeout(config.timing.navigationTimeoutMs || 45000);
  const page = context.pages()[0] || await context.newPage();
  return { context, page };
}

async function isBlocked(page) {
  const text = await visibleText(page);
  if (/验证码|扫码验证|二次验证|安全验证|账号安全|verify|captcha/i.test(text)) {
    return { blocked: true, code: ERROR_CODES.CAPTCHA_REQUIRED, message: "Detected captcha, QR verification, or secondary verification" };
  }
  if (/登录|手机号|验证码登录/.test(text) && !/发布|通知|消息|我/.test(text)) {
    return { blocked: true, code: ERROR_CODES.LOGIN_REQUIRED, message: "Login appears to be required" };
  }
  return { blocked: false };
}

async function visibleText(page) {
  return await page.evaluate(() => document.body ? document.body.innerText.slice(0, 12000) : "");
}

async function login(config) {
  ensureQueue(config);
  const { context, page } = await launch(config);
  try {
    await page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "domcontentloaded" });
    logLine(config, "info", "login_page_opened", { url: page.url(), userDataDir: config.userDataDir });
    console.log("\n请在打开的浏览器里完成小红书登录。完成后回到终端按 Enter。遇到验证码或二次验证请手动处理；脚本不会绕过。\n");
    await waitEnter();
    await page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "domcontentloaded" });
    const block = await isBlocked(page);
    if (block.blocked) throw userError(block.code, block.message);
    logLine(config, "info", "login_state_saved", { userDataDir: config.userDataDir });
  } finally {
    await context.close();
  }
}

function waitEnter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question("", () => { rl.close(); resolve(); }));
}

async function ordinaryBrowse(config, page, phase) {
  if ((phase === "pre" && !config.timing.preBrowseEnabled) || (phase === "post" && !config.timing.postBrowseEnabled)) return;
  const startedAt = Date.now();
  let clickedNotes = 0;
  let returnedNotes = 0;

  await page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(rand(config.timing.browsePauseMsMin, config.timing.browsePauseMsMax));
  const block = await isBlocked(page);
  if (block.blocked) throw userError(block.code, `${phase} browse blocked: ${block.message}`);

  const scrolls = Number(config.timing.browseScrolls || 1);
  for (let i = 0; i < scrolls; i += 1) {
    await page.mouse.wheel(0, rand(450, 900));
    await page.waitForTimeout(rand(config.timing.browsePauseMsMin, config.timing.browsePauseMsMax));
  }

  const openNotes = Number(config.timing.browseOpenNotes || 0);
  for (let i = 0; i < openNotes; i += 1) {
    const links = await page.locator('a[href*="/explore/"]').count().catch(() => 0);
    if (!links) break;
    const index = Math.min(i, links - 1);
    const note = page.locator('a[href*="/explore/"]').nth(index);
    const beforeUrl = page.url();
    await note.click();
    clickedNotes += 1;
    await page.waitForTimeout(rand(config.timing.browsePauseMsMin, config.timing.browsePauseMsMax));
    if (page.url() !== beforeUrl) {
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "domcontentloaded" }));
    } else {
      await page.keyboard.press("Escape").catch(() => null);
      await page.waitForTimeout(500);
    }
    returnedNotes += 1;
    await page.waitForTimeout(rand(600, 1200));
  }

  if (openNotes > 0 && clickedNotes === 0) {
    throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, `${phase} browse could not find a note to click`);
  }
  if (clickedNotes > 0 && returnedNotes < clickedNotes) {
    throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, `${phase} browse clicked a note but did not return`);
  }

  const minDurationMs = Number(config.timing.browseMinDurationMs || 0);
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < minDurationMs) {
    await page.waitForTimeout(minDurationMs - elapsedMs);
  }

  logLine(config, "info", "ordinary_browse_done", {
    phase,
    scrolls,
    requestedOpenNotes: openNotes,
    clickedNotes,
    returnedNotes,
    durationMs: Date.now() - startedAt
  });
}

async function safeGoto(page, url, options = {}) {
  const timeout = options.timeout || 45000;
  const waitUntil = options.waitUntil || "domcontentloaded";
  try {
    await page.goto(url, { waitUntil, timeout });
    return { ok: true, url: page.url() };
  } catch (error) {
    const currentUrl = page.url();
    const text = await visibleText(page).catch(() => "");
    return {
      ok: false,
      url: currentUrl,
      message: error.message,
      visibleText: text.slice(0, 1000)
    };
  }
}

async function openPublishPage(config, page) {
  await safeGoto(page, "https://www.xiaohongshu.com/explore", { timeout: config.timing.navigationTimeoutMs || 45000 });
  await page.waitForTimeout(1200);
  let block = await isBlocked(page);
  if (block.blocked) throw userError(block.code, block.message);

  const publishLinks = [
    'a[href*="creator.xiaohongshu.com/publish"]',
    'a[href*="/publish/publish"]'
  ];
  for (const selector of publishLinks) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    await Promise.all([
      page.waitForTimeout(1000),
      locator.first().click()
    ]).catch(() => null);
    await page.waitForTimeout(5000);
    if (/creator\.xiaohongshu\.com/.test(page.url())) {
      block = await isBlocked(page);
      if (block.blocked) throw userError(block.code, block.message);
      return;
    }
  }

  const direct = await safeGoto(page, config.selectors.publishUrl, { timeout: config.timing.publishNavigationTimeoutMs || 90000 });
  await page.waitForTimeout(5000);
  block = await isBlocked(page);
  if (block.blocked) throw userError(block.code, block.message);
  if (!direct.ok) {
    const text = await visibleText(page).catch(() => "");
    if (!text.trim()) {
      throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, `Publish page did not load: ${direct.message}`);
    }
  }
}

function rand(min, max) {
  return Math.floor(Number(min) + Math.random() * (Number(max) - Number(min) + 1));
}

async function publishOne(config, page, content) {
  await openPublishPage(config, page);
  await page.waitForTimeout(2500);
  let block = await isBlocked(page);
  if (block.blocked) throw userError(block.code, block.message);

  await selectImageTab(page);
  await uploadImage(page, content.imagePath);
  await fillPublishFields(page, content);

  if (config.dryRun) {
    logLine(config, "warn", "dry_run_publish_skipped", { item: path.basename(content.itemDir), title: content.title });
    return { dryRun: true, url: page.url() };
  }

  await clickPublish(page);
  await page.waitForTimeout(config.timing.postPublishWaitMs || 8000);
  block = await isBlocked(page);
  if (block.blocked) throw userError(block.code, block.message);
  const text = await visibleText(page);
  if (/图片编辑/.test(text) && /笔记预览/.test(text) && /编辑于\s*刚刚/.test(text)) {
    throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, "Publish click did not leave the editor page");
  }
  if (/失败|违规|审核不通过|限流|异常|请稍后|发布失败/.test(text)) {
    throw userError(ERROR_CODES.PUBLISH_REJECTED, "Page showed a publish failure or rejection message");
  }
  return { dryRun: false, url: page.url() };
}

async function selectImageTab(page) {
  const tabTexts = ["上传图文", "图片", "图文"];
  for (const text of tabTexts) {
    const locator = page.getByText(text, { exact: true });
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const clicked = await clickLocatorOrDomText(page, locator.first(), text);
    if (!clicked) continue;
    await page.waitForTimeout(1800);
    const visible = await visibleText(page).catch(() => "");
    if (/上传图文|图片大小|图片格式|拖拽图片|上传图片|支持.*图片/.test(visible) && !/上传图文，请先切换到图片tab/.test(visible)) {
      return true;
    }
  }

  const body = await visibleText(page).catch(() => "");
  if (/上传视频/.test(body) && /上传图文/.test(body)) {
    throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, "Could not switch from video tab to image/text tab");
  }
  return false;
}

async function clickLocatorOrDomText(page, locator, text) {
  try {
    await locator.click({ timeout: 5000 });
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (!/outside of the viewport|Timeout|not visible|intercepts pointer events/i.test(message)) {
      throw error;
    }
  }

  return await page.evaluate((targetText) => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
    };

    const elements = Array.from(document.querySelectorAll("button, [role='tab'], li, a, span, div"));
    const matched = elements.find((element) =>
      isVisible(element) &&
      (element.textContent || "").trim() === targetText
    );
    if (!matched) return false;

    let target = matched;
    for (let i = 0; i < 5 && target.parentElement; i += 1) {
      const role = target.getAttribute("role");
      const tag = target.tagName.toLowerCase();
      const className = String(target.className || "");
      if (tag === "button" || tag === "a" || role === "tab" || /tab|item|nav|upload/i.test(className)) break;
      target = target.parentElement;
    }
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    target.click();
    return true;
  }, text);
}

async function uploadImage(page, imagePath) {
  if (!imagePath) return;
  const inputs = await page.locator('input[type="file"]').count().catch(() => 0);
  if (inputs > 0) {
    await page.locator('input[type="file"]').first().setInputFiles(imagePath);
    await page.waitForTimeout(2500);
    return;
  }

  const uploadTexts = ["上传图文", "上传图片", "上传", "选择图片"];
  for (const text of uploadTexts) {
    const locator = page.getByText(text, { exact: false });
    if (await locator.count().catch(() => 0)) {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 8000 }),
        locator.first().click()
      ]);
      await chooser.setFiles(imagePath);
      await page.waitForTimeout(2500);
      return;
    }
  }
  throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, "Could not find image upload control");
}

async function fillPublishFields(page, content) {
  const titleFilled = await fillFirst(page, [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    '[contenteditable="true"][placeholder*="标题"]'
  ], content.title);

  const bodyFilled = await fillFirst(page, [
    'textarea[placeholder*="正文"]',
    'textarea[placeholder*="描述"]',
    '[contenteditable="true"][placeholder*="正文"]',
    '[contenteditable="true"]'
  ], content.body);

  if (!titleFilled && !bodyFilled) {
    throw userError(ERROR_CODES.PUBLISH_UI_CHANGED, "Could not find title or body input fields");
  }
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const target = locator.first();
    if (selector.includes("contenteditable")) {
      await target.click();
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.type(value);
    } else {
      await target.fill(value);
    }
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function clickPublish(page) {
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(500);

  const candidates = [
    page.getByRole("button", { name: "发布", exact: true }),
    page.getByText("发布", { exact: true }),
    page.locator('button:has-text("发布")')
  ];
  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    if (count === 1) {
      await locator.click();
      return;
    }
    if (count > 1) {
      const clicked = await clickLowestVisible(page, locator, count);
      if (clicked) return;
    }
  }

  const clicked = await page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, "");
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;
    };
    const elements = Array.from(document.querySelectorAll("button, [role='button'], div, span"))
      .filter((element) => isVisible(element) && clean(element.textContent) === "发布")
      .map((element) => {
        let target = element;
        for (let i = 0; i < 4 && target.parentElement; i += 1) {
          const tag = target.tagName.toLowerCase();
          const role = target.getAttribute("role");
          const className = String(target.className || "");
          if (tag === "button" || role === "button" || /button|btn|publish/i.test(className)) break;
          target = target.parentElement;
        }
        return { element, target, rect: target.getBoundingClientRect() };
      })
      .filter((entry) => isVisible(entry.target))
      .sort((a, b) => b.rect.top - a.rect.top);
    if (!elements.length) return false;
    const target = elements[0].target;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    target.click();
    return true;
  });
  if (clicked) return;

  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  await page.mouse.click(viewport.width * 0.52, viewport.height - 45);
  return;
}

async function clickLowestVisible(page, locator, count) {
  const candidates = [];
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    const box = await item.boundingBox().catch(() => null);
    if (!box || box.width <= 0 || box.height <= 0) continue;
    candidates.push({ item, box });
  }
  candidates.sort((a, b) => b.box.y - a.box.y);
  for (const candidate of candidates) {
    try {
      await page.mouse.click(
        candidate.box.x + candidate.box.width / 2,
        candidate.box.y + candidate.box.height / 2
      );
      return true;
    } catch (_error) {
      // Try the next visible candidate.
    }
  }
  return false;
}

async function runOnce(config) {
  ensureQueue(config);
  const items = pendingItems(config);
  if (!items.length) {
    logLine(config, "warn", ERROR_CODES.QUEUE_EMPTY, { message: "待发布队列已空,需要补充内容" });
    return;
  }

  const itemDir = items[0];
  let content;
  try {
    content = readContent(itemDir, config);
  } catch (error) {
    const target = moveItem(config, itemDir, "failed", {
      reason: error.code || ERROR_CODES.CONTENT_INVALID,
      message: error.message
    });
    logLine(config, "error", "content_invalid_moved", { item: path.basename(itemDir), target, reason: error.message });
    return;
  }

  let context;
  let page;
  try {
    ({ context, page } = await launch(config));
  } catch (error) {
    logLine(config, "error", "browser_launch_failed", {
      item: path.basename(itemDir),
      message: error.message,
      pendingKept: true
    });
    return;
  }
  try {
    await ordinaryBrowse(config, page, "pre");
    const result = await publishOne(config, page, content);
    await ordinaryBrowse(config, page, "post");
    const target = moveItem(config, itemDir, "published", {
      platform: config.platform,
      dryRun: config.dryRun,
      title: content.title,
      result
    });
    logLine(config, "info", "published_moved", { item: path.basename(itemDir), target, dryRun: config.dryRun });
  } catch (error) {
    const screenshot = path.join(config.queueRoot, "logs", `failure_${path.basename(itemDir)}_${localStamp()}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => null);
    const target = moveItem(config, itemDir, "failed", {
      reason: error.code || ERROR_CODES.UNKNOWN,
      message: error.message,
      screenshot
    });
    logLine(config, "error", "publish_failed_moved", {
      item: path.basename(itemDir),
      target,
      reason: error.code || ERROR_CODES.UNKNOWN,
      message: error.message,
      screenshot
    });
  } finally {
    await context.close();
  }
}

function check(config) {
  ensureQueue(config);
  const items = pendingItems(config);
  logLine(config, "info", "queue_check", {
    queueRoot: config.queueRoot,
    pendingCount: items.length,
    firstPending: items[0] ? path.basename(items[0]) : null,
    dryRun: config.dryRun
  });
}

function help() {
  console.log(`Usage:
  node xhs-publisher/publisher.cjs login [--config xhs-publisher/config.json]
  node xhs-publisher/publisher.cjs run-once [--config xhs-publisher/config.json] [--dry-run|--live]
  node xhs-publisher/publisher.cjs check [--config xhs-publisher/config.json]

Queue item format:
  social-publisher-queue/pending/2026-07-06-001/
    text.md       required
    image.png     required by default
    image_prompt.txt optional
    meta.json     optional
`);
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig(args);
  if (config.platform !== "xiaohongshu") throw new Error("Only xiaohongshu is supported in this MVP");

  if (args.command === "login") await login(config);
  else if (args.command === "run-once") await runOnce(config);
  else if (args.command === "check") check(config);
  else help();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
