---
name: xhs-content-publish-workflow
description: Use this skill when the user wants a complete Xiaohongshu workflow from current hot topic or theme to social copy, image prompt, generated cover image, filesystem queue item, draft preparation, dry-run validation, or live publishing. This skill orchestrates content production and account publishing end to end while keeping the content generator and publisher script decoupled through the queue directory.
---

# Xiaohongshu Content Publish Workflow

Use this skill for the full flow: topic/theme -> copy -> image -> queue -> Xiaohongshu draft/dry-run/live publish.

This is an orchestration skill. It does not merge content generation code with the publisher. Handoff between the two remains filesystem-only.

## Components

Content Skill:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/hotspot-copy-generator/SKILL.md
/Users/a37/Documents/Codex/2026-07-03/wo-xi/hotspot-copy-generator/references/style-guide.md
```

Publisher:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/xhs-publisher/run.sh
/Users/a37/Documents/Codex/2026-07-03/wo-xi/xhs-publisher/config.json
```

Queue:

```text
/Users/a37/Documents/Codex/2026-07-03/wo-xi/social-publisher-queue
```

Each generated item must be written as:

```text
social-publisher-queue/pending/<item-id>/
├── text.md
├── image.png
├── image_prompt.txt
└── meta.json
```

## Output Modes

Default mode is **draft** unless the user explicitly says otherwise.

- `draft`: generate content and image, write queue item, run `xhs-publisher/run.sh run-once --draft`; fill the Xiaohongshu publish page, do not click publish, keep item in `pending/`.
- `dry-run`: run `xhs-publisher/run.sh run-once --dry-run`; fill the publish page, skip publish, then move item to `published/` as a dry-run record.
- `live`: run `xhs-publisher/run.sh run-once --live`; click the publish button. Use only when the user explicitly asks for real publishing, clicking publish, or `--live`.

If the user says “完整流程” without saying to click publish, use `draft`.

## Workflow

1. Determine output mode: `draft`, `dry-run`, or `live`.
2. Read `hotspot-copy-generator/SKILL.md` and `references/style-guide.md`.
3. If the topic involves current news, weather, platform trends, laws, prices, or other changing facts, verify with reliable current sources before writing.
4. Produce one publish-ready Xiaohongshu copy and one image prompt using the style guide.
5. Run the anti-AI-flavor self-check before queueing:
   - Body is not broken into one-sentence-per-line poetic formatting.
   - No precise quantified metaphors or calculated emotional numbers.
   - No forced summary, slogan, uplift, or gold-line ending.
   - No generic phrases listed as prohibited in the style guide.
   - Factual claims use cautious wording when exact facts are not essential.
6. Generate the cover image with the current available image generation tool.
7. Inspect the image before queueing:
   - Low saturation/dark or cool tone as specified.
   - Ordinary lived-in scene, not glossy ad/poster style.
   - No obvious brand logo, public figure, watermark, unreadable large text, or disaster sensationalism.
   - Avoid over-clean, over-symmetrical, sticker-heavy, or generic AI-poster look.
8. Create one queue item under `pending/` with `text.md`, `image.png`, `image_prompt.txt`, and `meta.json`.
9. Run the publisher command for the selected mode.
10. If login, captcha, QR verification, or second verification appears, keep the browser open for manual handling and keep the queue item in `pending/`; after the user handles it, rerun the selected publisher command.
11. Report the result with paths to the queue item/result and whether publish was skipped, drafted, or live-clicked.

## AI-Flavor Boundary

Do not claim that content or images are guaranteed to avoid platform AI detection. Instead, reduce AI-like signals through concrete checks:

- Copy should sound like a specific person noticing a specific scene, not a generic content template.
- Prefer one small lived detail over broad life advice.
- Do not over-polish the ending.
- Images should look like ordinary phone/lifestyle photography or restrained text-card references, not commercial AI poster output.
- Always leave final review to the user before `live`.

## Commands

Run commands from:

```bash
cd /Users/a37/Documents/Codex/2026-07-03/wo-xi
```

Check queue:

```bash
xhs-publisher/run.sh check
```

Prepare draft:

```bash
xhs-publisher/run.sh run-once --draft
```

Dry-run publish flow:

```bash
xhs-publisher/run.sh run-once --dry-run
```

Live publish:

```bash
xhs-publisher/run.sh run-once --live
```

## Safety Rules

- Do not use `live` unless the user explicitly asks to click publish or truly publish.
- Do not bypass captcha, QR verification, second verification, account checks, or platform security.
- Do not silently retry failed publishing.
- Do not refill content when the user only asked to publish an existing pending item.
- Do not commit `config.json`, browser profiles, queue runtime content, screenshots, or logs to Git.
