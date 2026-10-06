# opencode-zh-hans 插件

OpenCode TUI 简体中文汉化插件。在渲染层按词典精确匹配翻译界面文字，**不改动 opencode 二进制**，升级后通常无需重新处理。

## 安装

```sh
bash install.sh
```

安装位置：`~/.config/opencode/plugins/zh-hans/`（opencode 会自动发现并加载，无需修改配置）。

手动安装等价于把以下文件复制到 `~/.config/opencode/plugins/zh-hans/`：

```text
package.json  tui.js  translate.js  dict.json
```

## 卸载

```sh
rm -rf ~/.config/opencode/plugins/zh-hans
```

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

## 升级后自检

插件加载与 hook 注册结果写在 `/tmp/zh-hans-plugin.log`：

```text
setup：内置词典 1444 条，审计模式 关
TextBuffer.setStyledText：注册成功
InputRenderable.placeholder：注册成功
TextareaRenderable.placeholder：注册成功
```

- 如果 opencode/OpenTUI 大版本升级后界面变回英文，先看这个日志：出现“类不存在/不是可写访问器”说明内部 API 变了，需要适配 hook。
- hook 失效时插件静默降级（界面回英文），**不会导致 TUI 崩溃**。

## 词典维护

- `dict.json` 由三层合成（后者覆盖前者）：
  1. `dict/zh-CN.json`：源码汉化词典
  2. `dict/runtime-extra.json`：运行时补充（带前导空格的自动补全项、placeholder 组合串等）
  3. `dict/refinements.json`：翻译优化覆盖层（正式化/语境调整，优先级最高）

```sh
# 在仓库根目录执行
node plugin/scripts/build-dict.mjs
```

- 覆盖率审计（开发用）：`node scripts/audit.mjs`，会在独立 tmux 会话中巡检主要界面，未命中英文写入 `audit/unmatched.json`。
- 有意保留英文的项见 `audit/known-remaining.md`（模型名、命令、快捷键、枚举值、路径等）。

## 说明

- 本仓库只包含插件方案；插件对已经是中文的文本不会重复翻译。
- 想彻底移除汉化：删除插件目录即可（见上文"卸载"）。
- 想修改内置译文：编辑仓库根目录 `dict/refinements.json`（优先级最高）后执行 `node plugin/scripts/build-dict.mjs` 重建，再重新安装。

## 原理

- hook `TextBuffer.setStyledText` 的 chunk 层：所有文本渲染的主路径
- hook `InputRenderable.placeholder` / `TextareaRenderable.placeholder`：输入框占位符
- 只做精确匹配，避免误翻动态内容（模型输出、路径、命令等）
