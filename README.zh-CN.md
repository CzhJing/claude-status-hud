# claude-status-hud

[English](README.md) | [中文](README.zh-CN.md)

Claude Code & Codebuddy Code 富信息状态栏插件。跨平台，零依赖。

![Status HUD 预览](preview-2.png)
## 显示内容

```
Model:Opus 4 ctx:[████░░░░░░]28% | usage:[████░░]75% (2h29m / 5h)|[█░░░░░]12% (3d11h / 7d)
project:my-project | ⎇ feat/my-branch* | update:+126 | delete:-16
cost: $1.84  ⏱︎: 6m11s(2m57s api)  token[⬆ 468/⬇ 6.1k] | 3 Mcps | 174 Skills | 75 Clis | 32 Hooks
tools:Read×2, Edit
agent:cli, Explore ● running
todo:[█████░░░░░]3/6 (50%) ▸ Fix edge case
```

**第一行：** 模型名称、上下文窗口使用进度条（颜色随用量变化：绿色 <50%、黄色 <80%、红色 >=80%）、速率限额进度条及重置倒计时（5h / 7d）。无订阅时显示 "For subscribers only"

**第二行：** 项目名称、Git 分支名、未提交修改标识（`*`）、领先/落后上游提交数（`↑2 ↓1`）、新增/删除行数

**第三行：** 会话费用（美元）、总耗时、API 耗时、输入/输出 token 数、活跃 MCP 服务器数、已安装 Skills 数、CLI 命令数、Hooks 数

| codeBuddy无法显示以下内容

**第四行：** 活跃工具及调用次数（如 `Read×2, Edit`）— 仅在工具运行或最近使用时显示

**第五行：** Agent 名称及运行/空闲状态（如 `cli, Explore ● running`）— 仅在存在 Agent trace 时显示

**第六行：** Todo 进度条，含已完成/总数、百分比及首个进行中任务（如 `3/6 (50%) ▸ Fix edge case`）— 仅在存在任务时显示

## 安装

### `Claude Code` or `Codebuddy Code`

在 `Claude Code` or `Codebuddy Code`会话中依次执行：

```
/plugin marketplace add CzhJing/claude-status-hud
/plugin install claude-status-hud
/reload-plugins
```
## 更新

更新插件到最新版本：

```
/plugin update claude-status-hud
/reload-plugins
```

如果状态栏未正常显示，请重新运行 `/setup-status-hud`。

## 配置

安装后，在 Claude Code 中运行 `/setup-status-hud` 命令即可自动完成配置。如果提示无该 skill，请退出 Claude Code / Codebuddy Code 后重新启动，再重试。

## 环境要求

- **Claude Code** v2.1+ 或 **Codebuddy Code**（需支持 statusLine 功能）
- **Node.js**（Claude Code / Codebuddy Code 本身已要求安装）
- **Git**（可选，用于显示分支和状态信息）

## 零外部依赖

本插件仅使用 Node.js 内置模块，无需安装任何额外工具。

支持 **macOS**、**Linux** 和 **Windows**。

## 许可证

[MIT](LICENSE)
