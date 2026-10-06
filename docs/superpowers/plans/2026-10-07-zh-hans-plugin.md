# opencode TUI 汉化插件 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有二进制汉化方案改造成一个不改二进制、升级基本不受影响的 TUI 插件，并全量覆盖界面文案。

**Architecture:** 插件在 TUI 进程内 hook OpenTUI 的 `TextBuffer.setStyledText`（chunk 级）与输入框 `placeholder` 访问器，按运行时词典精确匹配翻译；词典由现有 1528 条译文生成，配合审计模式做覆盖率迭代。

**Tech Stack:** Bun（插件运行时，随 opencode 提供）、Node 24（脚本与单元测试，`node:test`）、tmux（巡检）。

**Spec:** `docs/superpowers/specs/2026-10-07-zh-hans-plugin-design.md`

## Global Constraints

- 只做精确匹配；禁止模糊/分词替换。
- hook 内任何异常必须捕获；hook 注册失败只写日志，不影响 TUI 启动。
- 不修改 opencode 二进制。
- 技术标识（命令名、快捷键、文件名、代码、模型/代理名）保持英文。
- 词典源：`~/coding/opencode-zh/dict/zh-CN.json`（1528 条）+ 运行时补充 `~/coding/opencode-zh/dict/runtime-extra.json`。
- 单元测试命令：`node --test plugin/test/`。
- 提交信息用中文；项目 git 仓库根在 `~/coding/opencode-zh`。

## Review Focus

1. `styled.chunks` 缺失或形状变化 → 静默跳过，不崩溃。
2. `chunk.text` 非字符串 / undefined → 跳过。
3. 覆盖词典 JSON 损坏 → 记录日志并回退内置词典。
4. 源词典同词多译 → 取最高频并输出冲突报告。
5. 动态内容恰好等于词条 → 只收录界面文案；对短词做一次人工复核。

---

### Task 1: 词典生成脚本

**Files:**
- Create: `plugin/scripts/build-dict.mjs`
- Create: `plugin/test/build-dict.test.mjs`
- Create: `plugin/test/fixtures/source.json`、`plugin/test/fixtures/extra.json`

**Interfaces:**
- Produces: `buildDictionary(sourceJson, extraJson) -> { version: 1, entries: Record<string, string>, conflicts: Array<{ key, chosen, alternatives }> }`（具名导出，供测试与 CLI 共用）
- CLI：`node plugin/scripts/build-dict.mjs [sourcePath] [extraPath] [outPath]`，默认源 `dict/zh-CN.json`、补充 `dict/runtime-extra.json`、输出 `plugin/dict.json`
- 源值可能是字符串或 `{ text, nth }`，统一取 `text`
- 合并规则：同 key 多译取出现次数最多者；平票取先出现者；`extra.entries` 覆盖全部；输出按 key 排序

- [ ] **Step 1: 写失败测试**（`plugin/test/build-dict.test.mjs`，用 `node:test` + `assert`）

断言（测试名即行为）：
- `合并多个模块并处理 {text,nth} 值`：source 含 `"Settings":"设置"`、`"change":{text:"切换",nth:[1,2]}` → entries 两者都在且 `change === "切换"`
- `同词多译取最高频并记录冲突`：source 中 `"Open"` 出现 2 次为 `"打开"`、1 次为 `"开启"` → `entries.Open === "打开"`，`conflicts` 含 `{key:"Open", chosen:"打开"}`
- `extra 覆盖内置词条`：extra `{"entries":{"Settings":"设定"}}` → `entries.Settings === "设定"`
- `输出按 key 排序且带 version`：`Object.keys(entries)` 有序，`version === 1`

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test plugin/test/build-dict.test.mjs`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `buildDictionary` 与 CLI**

要点：遍历 `source.modules` 的每个 `[原文, 值]`；用 `Map<原文, Map<译文, 次数>>` 统计；选择次数最多（平票取首次出现）的译文；`extra.entries` 直接覆盖；`conflicts` 仅收录有多个译文的 key；写出 JSON 时 `JSON.stringify({version,entries}, null, 1)`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test plugin/test/build-dict.test.mjs`
Expected: PASS

- [ ] **Step 5: 用真实词典生成 `plugin/dict.json`**

Run: `node plugin/scripts/build-dict.mjs`
Expected: 输出条目数 ≥ 1500；打印冲突数量

- [ ] **Step 6: 提交**

```bash
git add plugin/scripts/build-dict.mjs plugin/test/build-dict.test.mjs plugin/test/fixtures plugin/dict.json
git commit -m "feat(plugin): 词典生成脚本与运行时词典"
```

### Task 2: 翻译核心

**Files:**
- Create: `plugin/translate.js`
- Create: `plugin/test/translate.test.mjs`

**Interfaces:**
- Produces:
  - `createTranslator(entries, overrides = {}) -> { translate(text: string): string, applyChunks(chunks: unknown): number, size: number }`
  - `parseDictionary(json: unknown) -> Record<string, string>`（校验 `entries` 为 string→string，非法抛 `Error`）
- 语义：`translate` 精确匹配，`overrides` 优先，未命中原样返回；`applyChunks` 仅当 `Array.isArray(chunks)`，逐 chunk 替换字符串 `text` 并返回替换数；其余输入静默跳过

- [ ] **Step 1: 写失败测试**

断言：
- `精确匹配翻译`：entries `{"Settings":"设置"}`，`translate("Settings")==="设置"`
- `不做部分匹配`：`translate("Settings...")==="Settings..."`、`translate("Set")==="Set"`
- `overrides 优先`：overrides `{"Settings":"设定"}` → `"设定"`
- `非字符串输入原样返回`：`translate(undefined)`、`translate(123)` 不抛错
- `applyChunks 只处理字符串 text`：`[{text:"Exit"},{text:undefined},null,{text:123}]` 返回替换数 1，且第一项变为译文
- `applyChunks 对非数组输入返回 0`：`applyChunks(undefined)`、`applyChunks({chunks:[]})` → 0
- `parseDictionary 拒绝非法形状`：`{}`、`{entries:{"a":1}}` 抛 Error

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test plugin/test/translate.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 `plugin/translate.js`**

要点：`entries` 与 `overrides` 各建 `Map`（或对象 + `Object.hasOwn` 防原型污染）；`applyChunks` 内 try/catch 不抛出。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test plugin/test/`
Expected: PASS（两个测试文件全绿）

- [ ] **Step 5: 提交**

```bash
git add plugin/translate.js plugin/test/translate.test.mjs
git commit -m "feat(plugin): 运行时翻译核心与单元测试"
```

### Task 3: 插件主体与集成验证

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tui.js`

**Interfaces:**
- `package.json`：`{ "name": "opencode-zh-hans", "version": "0.1.0", "type": "module", "exports": { "./tui": "./tui.js" } }`
- `tui.js`：`export default Plugin.define({ id: "zh-hans", setup(context) {...} })`，`setup` 返回 cleanup（恢复被包装的原型）
- 词典加载：`new URL("./dict.json", import.meta.url)`；覆盖词典 `$XDG_CONFIG_HOME|~/.config` + `/opencode/zh-hans-overrides.json`（不存在则跳过，损坏则写日志回退）；加载与覆盖合并统一走 Task 2 的 `parseDictionary`
- hooks（存在才挂，失败只写日志）：
  - `core.TextBuffer.prototype.setStyledText`：调用原方法前 `translator.applyChunks(styled?.chunks)`
  - `core.InputRenderable.prototype.placeholder` / `core.TextareaRenderable.prototype.placeholder`：包装 setter，`typeof value === "string"` 时 `translate`
- 日志：`/tmp/zh-hans-plugin.log`（自检结果）；审计模式（`context.options?.audit === true`）把未命中且含 `[A-Za-z]{3}` 的 chunk 文本去重写入 `/tmp/zh-hans-audit.log`

- [ ] **Step 1: 创建 `package.json` 与 `tui.js`**（按上面的接口；hooks 用 try/catch，cleanup 恢复原型）

- [ ] **Step 2: 用环境变量注册启动 TUI（不改全局配置）**

```bash
tmux new-session -d -s zh-dev -x 120 -y 36
tmux send-keys -t zh-dev 'cd /tmp && OPENCODE_CLI_CONFIG_CONTENT='"'"'{"plugins":[{"package":"/home/xlht/coding/opencode-zh/plugin"}]}'"'"' /home/xlht/.opencode/bin/opencode.orig-v2.0.24 --standalone' Enter
```

（用原版二进制，避免与现有二进制汉化叠加。）

- [ ] **Step 3: 集成验证**

打开命令面板（`tmux send-keys -t zh-dev C-p`），`tmux capture-pane -p` 确认：
- 标题为「命令」、占位符为「搜索」（依赖 Task 1 生成的 `dict.json` 已包含这两条）
- `/tmp/zh-hans-plugin.log` 显示 `TextBuffer.setStyledText`、`InputRenderable.placeholder` 注册成功
- 若环境变量注册方式不生效：回退方案为临时复制 `plugin/` 到 `~/.config/opencode/plugins/zh-hans/` 测试，并记录该结论

- [ ] **Step 4: 损坏覆盖词典的降级验证**

写入非法 JSON 到 `~/.config/opencode/zh-hans-overrides.json`（测试后删除），重启 TUI 确认：
- TUI 正常启动且翻译仍生效（回退内置词典）
- `/tmp/zh-hans-plugin.log` 记录了覆盖词典解析失败

- [ ] **Step 5: 提交**

```bash
git add plugin/package.json plugin/tui.js
git commit -m "feat(plugin): TUI 插件主体与集成验证"
```

### Task 4: 完整词典与回归对照

**Files:**
- Modify: `plugin/dict.json`（重新生成）

- [ ] **Step 1: 重新生成完整词典**

Run: `node plugin/scripts/build-dict.mjs`
Expected: 条目 ≥ 1500

- [ ] **Step 2: 界面巡检对照**

用 Task 3 的启动方式依次查看：首页、命令面板、设置、模型选择、会话列表；截图保存到 `/tmp/zh-plugin-check/`。
与二进制汉化版对照，确认主要界面均为中文。

- [ ] **Step 3: 回归检查**

确认命令名（`/new`、`ctrl+p`）、快捷键、模型名、路径、动态内容未被误翻；对比原版启动时间无明显增加（目测 1 秒内）；如发现误翻，从 `plugin/dict.json` 移除对应词条并在提交信息中说明。

- [ ] **Step 4: 提交**

```bash
git add plugin/dict.json
git commit -m "chore(plugin): 生成完整运行时词典并通过回归对照"
```

### Task 5: 审计巡检脚本

**Files:**
- Create: `plugin/scripts/audit.mjs`

**Interfaces:**
- CLI：`node plugin/scripts/audit.mjs [输出目录，默认 plugin/audit]`
- 行为：用独立 tmux socket `-L zh-audit` 启动原版二进制 + 插件（`options.audit=true`）；依次访问首页、`ctrl+p`、设置、模型选择、会话列表、会话视图；每个界面 `capture-pane` 保存到 `<out>/shots/NN-<name>.txt`；结束后读取 `/tmp/zh-hans-audit.log`，去重过滤后写 `<out>/unmatched.json`（`[{text, count}]` 形式，按长度降序）
- 不改全局配置；不 kill 用户已有 tmux 会话

- [ ] **Step 1: 实现 `audit.mjs`**（`node:child_process` 调 tmux；固定等待时间；结束清理 `tmux -L zh-audit kill-server`）

- [ ] **Step 2: 运行验证**

Run: `node plugin/scripts/audit.mjs`
Expected: `plugin/audit/shots/` 至少 6 张截图；`plugin/audit/unmatched.json` 非空且为合法 JSON

- [ ] **Step 3: 提交**

```bash
git add plugin/scripts/audit.mjs plugin/audit
git commit -m "feat(plugin): 审计巡检脚本与首轮未命中报告"
```

### Task 6: 覆盖率补齐迭代

**Files:**
- Create/Modify: `dict/runtime-extra.json`（`{ "entries": { "英文渲染文本": "中文" } }`）
- Modify: `plugin/dict.json`（重建）

- [ ] **Step 1: 从 `plugin/audit/unmatched.json` 筛出真正的界面文案**（跳过动态内容、模型输出、技术标识）

- [ ] **Step 2: 翻译并写入 `dict/runtime-extra.json`**，重建词典：

Run: `node plugin/scripts/build-dict.mjs && node plugin/scripts/audit.mjs`
Expected: 未命中条目显著减少

- [ ] **Step 3: 迭代 ≤3 轮**；对短词（长度 ≤ 6 且无空格的词条）人工复核一遍，确认不会误翻动态内容；把无法/不应翻译的残留记入 `plugin/audit/known-remaining.md`

- [ ] **Step 4: 提交**

```bash
git add dict/runtime-extra.json plugin/dict.json plugin/audit
git commit -m "feat(plugin): 补齐运行时词典并完成覆盖率迭代"
```

### Task 7: 安装与文档

**Files:**
- Create: `plugin/README.md`（中文）
- Create: `plugin/install.sh`
- Modify: `README.md`（主文档，增加插件方案入口）

- [ ] **Step 1: 写 `plugin/README.md`**：安装/卸载、改词（覆盖词典）、升级后自检（看 `/tmp/zh-hans-plugin.log`）、与二进制方案的关系

- [ ] **Step 2: 写 `install.sh`**：复制 `plugin/` 到 `~/.config/opencode/plugins/zh-hans/`（排除 test/scripts/audit）；卸载提示

- [ ] **Step 3: 安装并验证**

Run: `bash plugin/install.sh`，然后正常启动 `opencode`（已安装的二进制，不再叠加汉化时先用原版路径验证一次），确认中文界面生效。

- [ ] **Step 4: 提交**

```bash
git add plugin/README.md plugin/install.sh README.md
git commit -m "docs(plugin): 安装脚本与使用文档"
```
