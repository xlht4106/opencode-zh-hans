# opencode-zh-hans

OpenCode TUI 简体中文汉化插件：在渲染层按词典匹配翻译界面文字，opencode 升级后通常无需重新处理。

> 非官方插件，与 OpenCode 官方无关。

## 安装

```sh
opencode plugin add "opencode-zh-hans@git+https://github.com/xlht4106/opencode-zh-hans"
```

安装后由 opencode 管理（写入全局配置 `opencode.json` 的 `plugins` 数组），重启 opencode 生效。

```sh
opencode plugin list     # 查看已安装插件
opencode plugin update   # 更新到最新
opencode plugin remove   # 卸载
```

## 特性

- 全量 TUI 文案：主界面、命令面板、设置、对话框、会话界面、mini 界面、崩溃界面等
- 只按完整字符串匹配，不会误翻模型输出、文件路径、命令等动态内容
- hook 失效时静默降级（界面回英文），不会导致 TUI 崩溃
- 支持用户覆盖词典与翻译优化覆盖层

## 改词（可选覆盖词典）

创建 `~/.config/opencode/zh-hans-overrides.json`，格式与内置词典一致：

```json
{
  "version": 1,
  "entries": {
    "Settings": "设置",
    "Open": "打开"
  }
}
```

覆盖词典优先于内置词典；文件不存在时忽略，格式损坏时自动回退内置词典（不崩溃）。

永久修改请编辑 `dict/refinements.json`（优先级最高）后重新构建。

## 升级后自检

插件加载与 hook 注册结果写在 `/tmp/zh-hans-plugin.log`：

```text
setup：内置词典 1454 条，审计模式 关
TextBuffer.setStyledText：注册成功
InputRenderable.placeholder：注册成功
TextareaRenderable.placeholder：注册成功
```

- 如果 opencode/OpenTUI 大版本升级后界面变回英文，先看这个日志：出现"类不存在/不是可写访问器"说明内部 API 变了，需要适配 hook。
- hook 失效时插件静默降级（界面回英文），**不会导致 TUI 崩溃**。

## 目录结构

```text
package.json            # 插件包（exports: ./tui）
tui.js                  # 宿主 hook：TextBuffer.setStyledText / placeholder
translate.js            # 翻译核心（完整字符串匹配 + 受控摘要规则）
dict.json               # 运行时词典（由 dict/ 下三层合成）
scripts/build-dict.mjs  # 词典生成
scripts/audit.mjs       # tmux 巡检 + 未命中审计（开发用）
test/                   # node:test 单元测试
dict/                   # 词典源
  zh-CN.json            # 源码级汉化词典
  runtime-extra.json    # 运行时补充（自动补全项、placeholder 组合串等）
  refinements.json      # 翻译优化覆盖层（优先级最高）
audit/                  # 审计报告（known-remaining.md、unmatched.json）
docs/                   # 设计与实施文档
```

## 词典维护

```sh
node scripts/build-dict.mjs           # 重建 dict.json
node --test "test/*.test.mjs"         # 单元测试
node scripts/audit.mjs                # 覆盖率巡检（开发用，需要 tmux）
```

`dict.json` 由三层合成（后者覆盖前者）：`dict/zh-CN.json` → `dict/runtime-extra.json` → `dict/refinements.json`。

## 已知保留英文

模型名、提供商名、slash 命令、快捷键、设置枚举值、路径等有意保留英文，详见 `audit/known-remaining.md`。

## 原理

hook OpenTUI 的 `TextBuffer.setStyledText`（chunk 级）与 `InputRenderable` / `TextareaRenderable` 的 `placeholder`，按词典匹配翻译。插件运行时 `import "@opentui/core"` 解析到宿主自己的模块实例，因此原型补丁直接作用于 TUI 实际使用的类。

## 许可证类型

MIT
