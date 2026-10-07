// 运行时翻译核心：以精确匹配为主，另有一条受控的工具回合摘要规则。
// 供 TUI 插件（tui.js）使用；保持无宿主依赖，便于单元测试。

// 工具回合摘要（如 "1 command, 3 edits, 2 thoughts"）是运行时按数量拼接的整串，
// 精确匹配无法覆盖。这里的规则只匹配「数字 + 固定词表（可复数）」的逗号分隔串，
// 其余任何文本都不受影响。
const SUMMARY_UNITS = {
  command: "个命令",
  edit: "处编辑",
  thought: "条思考",
  read: "次读取",
  tool: "个工具",
  instruction: "条指令",
}
const SUMMARY_TOKEN = "\\d+ (?:commands?|edits?|thoughts?|reads?|tools?|instructions?)"
const SUMMARY_RE = new RegExp(`^(?:\\+ )?${SUMMARY_TOKEN}(?:, ${SUMMARY_TOKEN})*$`)
const SUMMARY_PART_RE = /^(\d+) (command|edit|thought|read|tool|instruction)s?$/

function translateSummary(text) {
  if (!SUMMARY_RE.test(text)) return null
  const prefix = text.startsWith("+ ") ? "+ " : ""
  const body = prefix ? text.slice(2) : text
  const parts = body.split(", ").map((part) => {
    const m = SUMMARY_PART_RE.exec(part)
    return `${m[1]} ${SUMMARY_UNITS[m[2]]}`
  })
  return prefix + parts.join("，")
}

/**
 * @param {Record<string,string>} entries   内置词典
 * @param {Record<string,string>} overrides 用户覆盖词典（优先）
 */
export function createTranslator(entries = {}, overrides = {}) {
  const base = new Map(Object.entries(entries))
  const over = new Map(Object.entries(overrides))
  const resolve = (text) => {
    if (over.has(text)) return over.get(text)
    const hit = base.get(text)
    if (hit !== undefined) return hit
    const summary = translateSummary(text)
    return summary === null ? text : summary
  }
  return {
    size: base.size,
    /** 精确匹配翻译；非字符串或未命中原样返回。 */
    translate(text) {
      if (typeof text !== "string") return text
      return resolve(text)
    },
    /** 就地翻译 styled.chunks；返回替换数。任何异常都吞掉，不影响渲染。 */
    applyChunks(chunks) {
      if (!Array.isArray(chunks)) return 0
      let n = 0
      try {
        for (const chunk of chunks) {
          if (!chunk || typeof chunk.text !== "string") continue
          const next = resolve(chunk.text)
          if (next !== chunk.text) {
            chunk.text = next
            n++
          }
        }
      } catch {
        // 渲染路径上的异常必须静默降级
      }
      return n
    },
  }
}

/** 校验词典 JSON 形状（{ version, entries }），返回 entries；非法抛 Error。 */
export function parseDictionary(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("词典必须是对象")
  const entries = json.entries
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("词典缺少 entries 对象")
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "string") throw new Error(`词条 ${key} 的译文不是字符串`)
  }
  return entries
}
