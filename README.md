# XHS Content Automation

这是一个小红书内容生产与账号发布分离的本地自动化项目。

项目分成两层：

- `hotspot-copy-generator/`：Codex Skill，负责根据热点、参考账号、风格规则生成社交媒体文案和配图 prompt。
- `xhs-publisher/`：独立 Playwright 脚本，负责登录态复用、读取已筛选内容队列、发布一条内容、记录成功或失败结果。

两者只通过文件目录交互。发布脚本不会调用内容生产 Skill，也不会生成文案或图片。

## 目录结构

```text
.
├── hotspot-copy-generator/
│   ├── SKILL.md
│   └── references/
│       └── style-guide.md
├── social-publisher-queue/
│   ├── pending/
│   ├── published/
│   ├── failed/
│   └── logs/
└── xhs-publisher/
    ├── publisher.cjs
    ├── config.example.json
    ├── package.json
    ├── run.sh
    └── README.md
```

## 内容生产 Skill

`hotspot-copy-generator` 用于把平台热点、热搜、爆款内容、链接、截图或文字描述转成可发布内容。

核心能力：

- 根据平台、关键词、参考账号抓取或整理热点信号
- 生成 1-3 个差异化文案方向
- 按 `references/style-guide.md` 的规则匹配文案风格
- 为每条文案生成对应配图 prompt
- 在全自动模式下，可使用当前环境可用的图片生成工具生成成品图

边界：

- 不登录账号
- 不发布内容
- 不定时
- 不操作平台后台

## 发布脚本

`xhs-publisher` 是独立账号操作脚本。它只读取人工筛选后放进队列的内容。

第一版能力：

- Playwright 登录态复用
- 读取 `pending/` 里排序第一条内容
- 发布前执行普通浏览测试流程
- 发布 `text.md` + `image.png`
- 发布后检查结果
- 成功移动到 `published/`
- 失败移动到 `failed/`
- 写入 `logs/publisher.log`
- `pending/` 为空时只写日志提醒
- 遇到登录失效、验证码、二次验证时停止并记录

普通浏览测试流程会打开首页、滚动、点开内容、返回，并保证流程时长至少 10 秒。日志会记录实际点击和返回数量。

## 队列格式

每条待发布内容是一个文件夹：

```text
social-publisher-queue/pending/2026-07-06-001/
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

## 安装与配置

进入发布脚本目录安装依赖：

```bash
cd xhs-publisher
npm install
```

复制配置文件：

```bash
cp config.example.json config.json
```

按本机路径修改：

- `queueRoot`
- `userDataDir`
- `browser.executablePath`
- `browser.homeDir`

默认 `dryRun` 为 `true`。确认流程稳定后，使用 `--live` 执行真实发布。

## 常用命令

登录并保存登录态：

```bash
xhs-publisher/run.sh login
```

检查队列：

```bash
xhs-publisher/run.sh check
```

干跑一条：

```bash
xhs-publisher/run.sh run-once
```

真实发布一条：

```bash
xhs-publisher/run.sh run-once --live
```

## 定时任务

可以用 cron 定时触发，每次只发布一条：

```cron
0 18 * * * cd /path/to/xhs-content-automation && xhs-publisher/run.sh run-once --live >> social-publisher-queue/logs/cron.log 2>&1
```

## 安全边界

这个项目不会绕过验证码、二次验证或平台安全校验。遇到这些情况时，脚本会停止并记录失败原因，等待人工处理。

不会上传到 GitHub 的本地数据包括：

- 浏览器登录态与 cookie
- `config.json`
- 队列中的实际待发布内容
- 已发布内容
- 失败截图
- 运行日志

