// 运行时翻译核心：只做精确匹配，不做部分/分词替换。
// 供 TUI 插件（tui.js）使用；保持无宿主依赖，便于单元测试。

/**
 * @param {Record<string,string>} entries   内置词典
 * @param {Record<string,string>} overrides 用户覆盖词典（优先）
 */
export function createTranslator(entries = {}, overrides = {}) {
  const base = new Map(Object.entries(entries))
  const over = new Map(Object.entries(overrides))
  return {
    size: base.size,
    /** 精确匹配翻译；非字符串或未命中原样返回。 */
    translate(text) {
      if (typeof text !== "string") return text
      if (over.has(text)) return over.get(text)
      const hit = base.get(text)
      return hit === undefined ? text : hit
    },
    /** 就地翻译 styled.chunks；返回替换数。任何异常都吞掉，不影响渲染。 */
    applyChunks(chunks) {
      if (!Array.isArray(chunks)) return 0
      let n = 0
      try {
        for (const chunk of chunks) {
          if (!chunk || typeof chunk.text !== "string") continue
          const next = over.has(chunk.text) ? over.get(chunk.text) : base.get(chunk.text)
          if (next !== undefined && next !== chunk.text) {
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
