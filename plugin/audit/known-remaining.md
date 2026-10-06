# 审计后有意保留英文的项

巡检（`plugin/audit/unmatched.json`，2026-10-07 第三轮）剩余 153 条，分类如下，均为有意保留：

## 1. 模型名与提供商名（动态目录，数量最多）

例如 `DeepSeek V4.1 Flash`、`GLM-5.3`、`Nemotron 3.5 Lightning Free`、`OpenCode Go`、`OpenCode Zen`、`Nvidia`、`Space Bunny`、`Big Pickle` 等。
这些是模型/提供商标识，保持英文。

## 2. Slash 命令与自动补全条目

例如 `…/agents     `、`…/new        `、`…/settings   `。
命令名必须保持英文（用户需要按原样输入 `/new` 等）。

## 3. 快捷键提示

例如 `ctrl+c, ctrl+d, ctrl+x q`、`ctrl+x m`、`shift+tab`、`esc`。
按键标识保持英文。

## 4. 设置枚举值与格式名

例如 `system`、`on`、`off`、`hide`、`auto`、`rendered`、`horizontal`、`word`、`low`、`max`、`compact`、`select`、`Markdown`。
这些是真实配置值或格式名，与二进制汉化版保持一致，不翻译。

## 5. 路径、品牌与缩写

例如 `/tmp`、`tmp`、`VCS`、`TPS`、`opencode`、`Build`（代理名）。

## 6. 动态内容

会话标题、模型输出、工具输出、文件路径等由运行内容决定，不翻译（精确匹配不会误伤）。

## 复核记录（Review Focus 5：短词）

词典中长度 ≤6 且不含空格的短词共 90 个，已逐个复核：全部为界面标签（如 `Yes`/`No`/`Exit`/`Search`/`Theme`）。
运行时只对"渲染出的完整 chunk 文本"做精确匹配，动态内容恰好等于这些短词才会被翻译，风险极低，接受。
