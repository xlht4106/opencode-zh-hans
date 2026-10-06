# opencode-zh-hans

OpenCode TUI 简体中文汉化插件：在渲染层按词典精确匹配翻译界面文字，**不改动 opencode 二进制**，opencode 升级后通常无需重新处理。

> 非官方插件，与 OpenCode 官方无关。

## 特性

- 全量 TUI 文案：主界面、命令面板、设置、对话框、会话界面、mini 界面、崩溃界面等
- 只做精确匹配，不会误翻模型输出、文件路径、命令等动态内容
- hook 失效时静默降级（界面回英文），不会导致 TUI 崩溃
- 支持用户覆盖词典与翻译优化覆盖层

## 安装

```sh
bash plugin/install.sh
```

安装到 `~/.config/opencode/plugins/zh-hans/`（opencode 自动发现，无需改配置），重启 opencode 后生效。

手动安装：把 `plugin/` 下的 `package.json`、`tui.js`、`translate.js`、`dict.json` 复制到 `~/.config/opencode/plugins/zh-hans/`。

## 卸载

```sh
rm -rf ~/.config/opencode/plugins/zh-hans
```

## 目录结构

```text
plugin/                 # 插件包（可安装）
  tui.js                # 宿主 hook：TextBuffer.setStyledText / placeholder
  translate.js          # 翻译核心（精确匹配 + 受控摘要规则）
  dict.json             # 运行时词典（由 dict/ 下三层合成）
  scripts/build-dict.mjs# 词典生成
  scripts/audit.mjs     # tmux 巡检 + 未命中审计（开发用）
  test/                 # node:test 单元测试
dict/                   # 词典源
  zh-CN.json            # 源码级汉化词典
  runtime-extra.json    # 运行时补充（自动补全项、placeholder 组合串等）
  refinements.json      # 翻译优化覆盖层（优先级最高）
docs/                   # 设计与实施文档
```

## 词典维护

```sh
node plugin/scripts/build-dict.mjs    # 重建 plugin/dict.json
node --test "plugin/test/*.test.mjs"  # 单元测试
node plugin/scripts/audit.mjs         # 覆盖率巡检（开发用，需要 tmux）
```

改词：

- 临时覆盖：`~/.config/opencode/zh-hans-overrides.json`（格式见 `plugin/README.md`）
- 永久修改：编辑 `dict/refinements.json` 后重新构建

## 已知保留英文

模型名、提供商名、slash 命令、快捷键、设置枚举值、路径等有意保留英文，详见 `plugin/audit/known-remaining.md`。

## 原理

hook OpenTUI 的 `TextBuffer.setStyledText`（chunk 级）与 `InputRenderable` / `TextareaRenderable` 的 `placeholder`，按词典精确匹配翻译。插件运行时 `import "@opentui/core"` 解析到宿主自己的模块实例，因此原型补丁直接作用于 TUI 实际使用的类。

## 文档

- 设计文档：`docs/superpowers/specs/2026-10-07-zh-hans-plugin-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-07-zh-hans-plugin.md`
