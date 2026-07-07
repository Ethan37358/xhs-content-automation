---
name: xhs-account-publisher
description: Use this skill when the user wants to operate a Xiaohongshu account for publishing, logging in, checking a filesystem publishing queue, running one approved post, or setting up cron-based scheduled publishing. This skill is only for account operations and queue publishing; it must not generate social copy, images, image prompts, topics, or replacement content.
---

# Xiaohongshu Account Publisher

Use this skill for the existing Xiaohongshu publishing automation in this workspace.

## Scope

This skill operates the account-publishing script only. It must stay decoupled from content production.

- Reads manually approved content from a filesystem queue.
- Publishes at most one pending item per run.
- Reuses Playwright browser login state.
- Records success, failure, and empty-queue results.
- Stops for manual handling if login, captcha, or second verification appears.
- Does not generate content, images, image prompts, topics, or replacement posts.
- Does not bypass platform security, captcha, or account checks.

## Project Paths

Default workspace:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi
```

Publisher script:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/xhs-publisher/publisher.cjs
```

Wrapper command:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/xhs-publisher/run.sh
```

Config:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/xhs-publisher/config.json
```

Queue root:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/social-publisher-queue
```

## Queue Contract

The queue contains:

```text
social-publisher-queue/
├── pending/
├── published/
├── failed/
└── logs/
```

Each pending item is a folder:

```text
pending/
└── item-name/
    ├── text.md
    ├── image.png
    ├── image_prompt.txt
    └── meta.json
```

Required:

- `text.md`
- one image file: `image.png`, `image.jpg`, `image.jpeg`, or `image.webp`

Optional:

- `image_prompt.txt`
- `meta.json`

The script reads the first pending folder by sorted folder name. On success, it moves the folder to `published/` with a timestamp. On failure, it moves the folder to `failed/` with failure details.

## Commands

Always run commands from the workspace root:

```bash
cd /Users/a37/Documents/Codex/2026-07-03/wo-xi
```

Check configuration and queue:

```bash
xhs-publisher/run.sh check
```

Open browser for manual login:

```bash
xhs-publisher/run.sh login
```

Run one item using config default `dryRun` value:

```bash
xhs-publisher/run.sh run-once
```

Run one item as dry run:

```bash
xhs-publisher/run.sh run-once --dry-run
```

Run one item as live publish:

```bash
xhs-publisher/run.sh run-once --live
```

## Workflow

1. Confirm the user wants account publishing, login, queue checking, or scheduling, not content generation.
2. Inspect `xhs-publisher/config.json` only when needed. Do not print secrets or local browser-state details unless relevant.
3. Check the queue before live publishing when the user asks for a test or real run.
4. If `pending/` is empty, report that the queue is empty and do not generate replacement content.
5. For login, run the login command and let the user handle QR code, captcha, or second verification manually.
6. For one publish run, use `run-once`; use `--live` only when the user clearly asks to actually publish.
7. Report the result: published, failed, blocked by login/verification, or queue empty.
8. If a failure folder or log entry is created, summarize the failure reason and point to the relevant local path.

## Scheduling

For cron scheduling, write or update a cron entry that calls `xhs-publisher/run.sh run-once` from the workspace root. Keep frequency configurable by cron, not hard-coded in the script. Do not schedule live publishing without explicit user confirmation.

## Safety Rules

- Do not create, rewrite, or refill queue content as part of this skill.
- Do not call `hotspot-copy-generator` or any content-production skill.
- Do not silently retry failed publishing.
- Do not bypass captcha, second verification, login checks, rate limits, or platform security controls.
- If the platform UI changes and selectors fail, stop and report the concrete failure instead of guessing through risky clicks.
- Keep `xhs-publisher/config.json`, `browser-profile/`, logs, and queue runtime content out of Git unless the user explicitly requests otherwise and sensitive data has been checked.
