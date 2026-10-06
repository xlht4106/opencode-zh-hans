# opencode TUI 汉化补丁（本机版）

把本机安装的 OpenCode v2.0.24 终端界面（TUI）汉化为简体中文的补丁工具与词典。

## 当前状态

- 汉化补丁已安装到：`~/.opencode/bin/opencode`（v2.0.24，已汉化）
- 原版备份：`~/.opencode/bin/opencode.orig-v2.0.24`
- 补丁版副本：`~/coding/opencode-zh/dist/opencode-zh-v2.0.24`
- 当前安装的补丁版 = **界面汉化 + 一个可选的"模型工具调用自动重试"兼容补丁**（见下文，与汉化相互独立）

> 注意：当前正在运行的 opencode 进程仍使用旧文件（内存中的旧版本），**下次启动**即为中文界面。

## 恢复原版

```sh
cp ~/.opencode/bin/opencode.orig-v2.0.24 ~/.opencode/bin/opencode.new
mv ~/.opencode/bin/opencode.new ~/.opencode/bin/opencode
```

（运行中的 opencode 占用二进制文件，必须用 `cp` + `mv` 的方式替换。）

## 覆盖范围

- 全量 TUI 文案：主界面、命令面板、设置、各类对话框、会话界面、mini 界面、崩溃界面、开发覆盖层等
- 共 **1528 条词条**，覆盖 6 个核心前端模块
- 以下内容**保持英文**（有意为之）：
  - 设置项的枚举值（`system` / `on` / `hide` / `rendered` 等，它们是实际配置值）
  - 模型名、代理名、命令名、快捷键、文件名、代码
  - 模型输出、工具输出、服务端返回的动态内容
  - 发送给模型的系统提示词（如 /btw 的提示词）
  - 部分开发者内部日志与 storybook 开发界面

## 兼容补丁：模型工具调用自动重试（可选）

**背景**：部分模型/网关（实测为 `fledge-alpha-free`）偶发返回畸形的工具调用分片，例如：

```json
{"index":0,"id":"functions.unknown:0","function":{"name":"","arguments":"{}"}}
```

工具名是空的，opencode 会报 `OpenAI Chat tool call delta is missing id or name` 并中断本轮。
实测**原版 opencode 同样会报这个错**（与汉化无关）：同一提示词下原版约 15%~25% 的请求失败，
换用 DeepSeek 等模型则稳定正常。

**补丁内容**：把 `InvalidProviderOutput` 归类为可重试，opencode 会按内置退避策略自动重试
（最多 3 次）。实测把 Fledge 的成功率从约 80% 提升到约 94%；若模型连续多次返回畸形调用仍会失败，
根治需要模型/网关侧修复，或改用稳定模型。

- 补丁定义在 `dict/provider-retry.json`，由 `tools/merge-dict.mjs` 合并进最终词典
- **不想要这个补丁**：用 `./apply-zh.sh --no-retry` 构建（只做界面汉化）

## 升级后重新打补丁

OpenCode 升级会覆盖汉化文件，重新执行：

```sh
cd ~/coding/opencode-zh
./apply-zh.sh <原版二进制路径> [输出路径]
```

例如使用备份作为原版：

```sh
./apply-zh.sh ~/.opencode/bin/opencode.orig-v2.0.24
```

然后按脚本提示安装。说明：

- 词典按"模块哈希名"索引，OpenCode 升级后哈希名可能变化；脚本会自动尝试**按内容匹配**模块。
- 如果升级跨度较大导致匹配失败，需要重新扫描生成词典（可再找 AI 助手做一轮）。
- 若 Bun 的单文件格式发生大改，脚本会报错而不是产出坏文件，此时请勿强行使用。

## 修改译文

编辑 `dict/zh-CN.json`：

```jsonc
{
  "modules": {
    "chunk-xxxx.js": {
      "Settings": "设置",              // 替换该模块内所有出现
      "change": { "text": "切换", "nth": [1, 2] }  // 只替换第 1、2 次出现（1 起，AST 顺序）
    }
  },
  "rawEdits": {
    "chunk-yyyy.js": [
      { "find": "精确源码片段", "replace": "替换后的源码片段" }
    ]
  }
}
```

改完重新生成补丁（用原版二进制）：

```sh
node tools/patch-zh.mjs ~/.opencode/bin/opencode.orig-v2.0.24 dict/zh-CN.json /tmp/opencode.zh
```

## 工具说明

| 文件 | 用途 |
| --- | --- |
| `tools/lib.mjs` | 解析 ELF `.bun` 段与 Bun V4 模块图 |
| `tools/extract.mjs` | 把二进制内的全部模块提取到目录 |
| `tools/scan.mjs` | 用 AST 扫描模块中的候选界面文案 |
| `tools/pick.mjs` / `tools/pick2.mjs` | 从扫描结果筛选待翻译文案 |
| `tools/patch-zh.mjs` | 应用词典、重打包并修正 ELF 头，产出补丁版 |
| `tools/merge-dict.mjs` | 合并翻译批次与补充词典，生成 `dict/zh-CN.json` |
| `tools/split-todo.mjs` | 拆分翻译任务批次 |
| `dict/zh-CN.json` | 最终词典（1528 条，含合并后的源码级替换） |
| `dict/pass2.json` | 补充/定向替换词条与源码级替换 |
| `dict/provider-retry.json` | 可选的模型工具调用自动重试兼容补丁（与汉化独立） |
| `work/` | 提取的模块、扫描报告、中间产物（可删除） |

## 技术原理（简）

1. OpenCode 是 Bun 单文件程序：界面 JS 代码打包在 ELF 的 `.bun` 段中（Bun V4 模块图格式）。
2. 每个 JS 模块带一份 JSC 预编译字节码，运行时优先执行字节码。补丁会**清零被修改模块的字节码指针**，使其回退执行翻译后的源码。
3. 模块源码以 Latin-1 存储，直接写中文会乱码；因此译文统一转义为 `\uXXXX`（保持源码纯 ASCII，运行时解析为中文）。
4. 内容变长时追加到模块区末尾，并同步修正负载长度前缀、`byte_count`、`.bun` 段头、RW LOAD 段头和后续节偏移。

## 风险提示

- 这是非官方补丁，可能与个别插件或未来版本不兼容；出问题用上面的恢复命令还原。
- 升级、`opencode upgrade`、重新安装都会覆盖汉化。
