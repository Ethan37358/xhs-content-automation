# Xiaohongshu Publisher

独立账号操作脚本。它只读取你手动筛选后放入队列的内容，不调用内容生产 Skill，不生成文案或图片。

## 目录约定

队列根目录由 `config.json` 里的 `queueRoot` 指定。

结构：

```text
social-publisher-queue/
├── pending/
├── published/
├── failed/
└── logs/
```

每条内容一个文件夹：

```text
pending/
└── 2026-07-06-001/
    ├── text.md
    ├── image.png
    ├── image_prompt.txt
    └── meta.json
```

必需：

- `text.md`
- `image.png`、`image.jpg`、`image.jpeg` 或 `image.webp`

可选：

- `image_prompt.txt`
- `meta.json`

`meta.json` 示例：

```json
{
  "title": "下班后不想说话",
  "tags": ["低能量生活", "普通人生活"],
  "source": "manual-approved"
}
```

## 安装依赖

如果本机没有 Playwright：

```bash
cd /path/to/xhs-content-automation/xhs-publisher
npm install
```

## 配置

复制配置文件：

```bash
cp config.example.json config.json
```

默认 `dryRun` 是 `true`，会填充发布页但不点击最终发布按钮。确认流程稳定后再改为：

```json
{
  "dryRun": false
}
```

默认使用有头模式运行浏览器：

```json
{
  "headless": false
}
```

发布前后普通浏览测试流程由 `timing` 配置控制。当前支持随机滚动、随机点击内容、打开内容后的随机停留和内容页内随机滚动；每个浏览阶段至少执行 `browseMinDurationMs` 指定的时长。

主要字段：

- `preBrowseEnabled` / `postBrowseEnabled`：发布前后是否执行普通浏览
- `browseMinDurationMs`：每个浏览阶段最短时长
- `browseScrollsMin` / `browseScrollsMax`：随机滚动次数
- `browseOpenNotesMin` / `browseOpenNotesMax`：随机打开内容数量
- `noteStayMsMin` / `noteStayMsMax`：打开内容后的随机停留时间
- `inNoteScrollsMin` / `inNoteScrollsMax`：内容页内随机滚动次数
- `browsePauseMsMin` / `browsePauseMsMax`：动作之间的随机停顿

## 登录

```bash
node xhs-publisher/publisher.cjs login --config xhs-publisher/config.json
```

如果使用当前 Codex 自带运行时，可以直接用包装脚本：

```bash
xhs-publisher/run.sh login
```

脚本会打开浏览器，你手动登录。登录态保存在：

```text
xhs-publisher/browser-profile
```

遇到验证码、扫码验证、二次验证，脚本不会绕过，需要你手动处理。

## 发布一条

每次只取 `pending/` 中按文件夹名排序的第一条：

```bash
node xhs-publisher/publisher.cjs run-once --config xhs-publisher/config.json
```

或：

```bash
xhs-publisher/run.sh run-once
```

强制真实发布：

```bash
node xhs-publisher/publisher.cjs run-once --config xhs-publisher/config.json --live
```

或：

```bash
xhs-publisher/run.sh run-once --live
```

强制干跑：

```bash
node xhs-publisher/publisher.cjs run-once --config xhs-publisher/config.json --dry-run
```

## 只测试普通浏览流程

这个命令只打开有头浏览器执行普通浏览测试，不读取 `pending/`，不进入发布页，也不会发布内容：

```bash
xhs-publisher/run.sh browse-test
```

如果出现登录弹窗、验证码、扫码验证或二次验证，脚本会停下并记录失败截图，需要先手动登录。

仅在 `browse-test` 中，如果公开信息流上方出现普通登录弹窗，脚本会尝试关闭弹窗后继续完成浏览测试；如果滚动或点击后又重复出现登录弹窗，也会再次关闭后继续。这个规则不用于发布流程，也不处理验证码、扫码验证或二次验证。

## Cron 示例

每天下午 6 点触发一次：

```cron
0 18 * * * cd /path/to/xhs-content-automation && /usr/local/bin/node xhs-publisher/publisher.cjs run-once --config xhs-publisher/config.json >> social-publisher-queue/logs/cron.log 2>&1
```

如果使用 Codex 自带 Node，可以用：

```cron
0 18 * * * cd /path/to/xhs-content-automation && xhs-publisher/run.sh run-once >> social-publisher-queue/logs/cron.log 2>&1
```

## 失败处理

- 队列为空：只写日志 `待发布队列已空,需要补充内容`
- 内容格式错误：移动到 `failed/`
- 登录失效、验证码、二次验证、发布 UI 找不到、平台拒绝：移动到 `failed/`，写 `failure.json` 和失败截图
- 不做静默重试
- 不自动补内容
