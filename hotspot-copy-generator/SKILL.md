---
name: hotspot-copy-generator
description: Semi-automatically discover current hot topics from configured platforms, keywords, account lists, trending pages, hot searches, viral posts, screenshots, links, or text briefs, then turn selected angles into publish-ready social media copy and matched image-generation prompts. Use for social media copy production, hot-topic angle selection, trend-jacking without copying, viral-content remixing, candidate topic screening, and generating 1-3 differentiated content directions with paired visual prompts. This skill only discovers and drafts content; it does not log in to accounts, operate platforms, schedule posts, or auto-publish.
---

# Hotspot Copy Generator

## Required Reference

Read only the topic-discovery scope in `references/style-guide.md` when running the semi-automatic candidate step. Read the full `references/style-guide.md` after the user confirms a candidate and before producing final copy or image prompts.

Use the style guide in this priority order:

1. Output examples
2. Explicit prohibited words, phrases, sentence patterns, and visual exclusions
3. Copy rules
4. Topic-discovery scope, visual reference accounts/links, and one-line visual tone
5. Other completed fields

If a field says `待补充`, do not invent rules for that field. Infer only from the examples and explicitly provided rules.

## Workflow

1. Determine the run mode before topic discovery:
   - If the user explicitly asks for full-auto mode, one-shot mode, auto-run, "全自动", "跑到底", or equivalent wording, use **Full-Auto Mode**.
   - If the user explicitly asks for candidate selection, manual confirmation, "先给候选", "我来选", or equivalent wording, use **Candidate Confirmation Mode**.
   - If the user does not specify a mode, ask once which mode to use before browsing or drafting:
     - Candidate Confirmation Mode: discover 2-3 candidate directions and wait for the user to choose.
     - Full-Auto Mode: internally select the single best direction, generate final copy, create the image prompt, and generate the image in one run.
2. Determine the topic input mode:
   - If the user provides a specific hot topic, viral post, screenshot, link summary, or text brief, use that as the source material.
   - If the user asks for topic discovery or provides only a platform, keyword range, account list, or category, run a semi-automatic topic discovery step before drafting.
   - If the user provides an intact phrase, meme sentence, quoted wording, or comma-separated spoken line, preserve it as one source signal first. Do not split words inside it into separate audience identities or keywords unless the user explicitly says they are separate filters.
3. For semi-automatic topic discovery, use the configured scope from `references/style-guide.md` plus any user-provided platform, keywords, account list, trend page, or source links.
   - Gather current public hot topics only when reliable access is available.
   - Do not log in, bypass access controls, scrape private content, or publish anything.
   - If live access is unavailable, state that the candidate list is based only on provided material and ask the user for links, screenshots, or copied trend text.
4. Screen candidate directions before formal copywriting:
   - In Candidate Confirmation Mode, output 2-3 candidate directions and wait for the user to choose.
   - In Full-Auto Mode, internally score candidates against the style guide's `候选初筛标准`, select the single strongest direction, and continue without asking the user to choose.
   - If no candidate meets the initial-screening criteria, stop and tell the user what was missing. Do not fabricate a topic.
5. For each candidate considered, use these criteria:
   - Topic or source signal
   - Source link or source description when available
   - Why it is worth considering
   - One-sentence suggested angle
   - Any uncertainty or fact-checking caveat
6. In Candidate Confirmation Mode, pause for the user to choose, reject, combine, or adjust the candidate direction. Do not move into final copy production until the user selects or confirms a direction.
   - If the user replies with only a number such as `1`, `2`, or `3`, treat it as selecting the corresponding candidate direction and continue into final copy production.
   - If the user replies with text feedback after copy has already been generated, treat it as revision feedback for the existing copy and image prompt. Enter the iteration workflow directly; do not restart topic discovery or show new candidates unless the user explicitly asks for new topics.
7. After the direction is confirmed by the user or selected internally in Full-Auto Mode, extract the reusable signal: subject, audience tension, emotional hook, controversy or curiosity point, timeliness, and why the source content likely spread.
8. Identify differentiated angles instead of copying the source:
   - Reframe the topic for a different audience need.
   - Challenge the common take with a defensible alternative.
   - Turn the hot topic into a concrete lesson, checklist, warning, comparison, or personal observation.
   - Avoid producing three versions that are only wording changes of the same idea.
9. Read `references/style-guide.md` and match the copy rules, examples, platform context, persona, and visual preferences.
10. Produce 1-3 publish-ready copy directions. For each direction, label the core angle difference in one short line.
11. Pair each copy direction with one image-generation prompt aligned to the visual reference section of the style guide.
12. In Full-Auto Mode, generate the final image for the selected copy using the image generation workflow.
13. Keep the output structured for quick selection. Do not add long explanations unless the user asks for reasoning.

## Full-Auto Mode

Use Full-Auto Mode when the user asks to run the entire workflow in one call.

- Do not stop to ask which candidate to choose.
- Browse or inspect the configured public sources from `references/style-guide.md`.
- Select exactly one direction that best matches `候选初筛标准`.
- Read the full style guide after selecting the direction.
- Generate the final copy, image prompt, and final image.
- Output the selected source signal, final copy, image prompt, and generated image together.
- Stop and report the issue only if no source material or current public hot topic meets the screening criteria.

## Image Generation Workflow

After writing the image prompt, decide how to generate the image:

1. If a separate image API integration is configured by the user or surrounding automation, use that integration first.
2. If no separate image API is configured, use the current environment's available image generation tool.
3. If no image generation capability is available, return the image prompt and clearly state that image generation could not be executed in this environment.

Never put API keys or private credentials in this skill. If an external image API is used outside the current environment, expect the surrounding automation to provide configuration such as `OPENAI_API_KEY`, image model, size, quality, and output directory.

## Iteration Workflow

When the user gives text feedback after a generated copy/prompt pair, revise the existing output instead of re-running topic discovery.

- Preserve the selected candidate direction unless the user asks to change it.
- Apply the feedback to the copy, the image prompt, or both based on the user's wording.
- Keep facts, uncertainty caveats, and prohibited style rules intact.
- Return only the revised content unless the user asks for a comparison or explanation.

## Candidate Topic Output

Use this format for the semi-automatic topic discovery step in Candidate Confirmation Mode:

```markdown
## 候选方向

### 1. <话题/信号>
- 来源：
- 值得考虑：
- 建议切入角度：
- 需确认：

### 2. <话题/信号>
- 来源：
- 值得考虑：
- 建议切入角度：
- 需确认：
```

After this output, ask the user to choose, combine, or adjust one candidate before producing final copy.

## Copy Requirements

- Produce copy that can be posted directly after human review.
- Preserve factual uncertainty. If the input includes unverified claims, write with attribution or uncertainty instead of presenting them as fact.
- Borrow the underlying angle, tension, or format from viral content; do not copy unique wording, proprietary creative, or personal material.
- Make each option meaningfully distinct in angle, reader promise, or emotional stance.
- Prefer concrete observations, specific hooks, and clean structure over generic advice.

## Image Prompt Requirements

- Write one image-generation prompt for each copy option.
- Align the prompt with the style guide's visual references and one-line tone.
- Include enough concrete visual detail to generate an image: subject, setting/background, composition-level intent, color/texture mood if specified, and any required text/no-text constraint from the style guide.
- Do not include unsupported brand logos, public figures, copyrighted characters, or private people unless the user explicitly provides rights or asks for a permitted abstract/fictional alternative.

## Prohibited

- Do not generate heavy "AI-flavored" filler such as empty motivational loops, over-balanced generic conclusions, or repetitive "not X but Y" slogans unless the style guide examples clearly use them.
- Do not use words, phrases, sentence patterns, punctuation habits, or visual elements that `references/style-guide.md` marks as prohibited.
- Do not pad three options with near-duplicate rewrites.
- Do not claim the content is guaranteed to go viral, increase revenue, or produce specific platform results.
- Do not log in to accounts, click platform UI, schedule posts, publish content, or modify automation scripts. Keep account operations separate from this skill.

## Output Format

```markdown
## 方向 1｜<核心角度差异>

**文案**
<可直接发布的文案>

**配图 prompt**
<图片生成 prompt>

## 方向 2｜<核心角度差异>

**文案**
<可直接发布的文案>

**配图 prompt**
<图片生成 prompt>
```

For one requested option, output only `方向 1`. For three requested options, output `方向 1` through `方向 3`.
