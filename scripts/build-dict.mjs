#!/usr/bin/env node
// 由源词典（dict/zh-CN.json）、运行时补充词典（dict/runtime-extra.json）
// 与翻译优化覆盖层（dict/refinements.json）生成插件的运行时词典 plugin/dict.json。
//
// 用法: node plugin/scripts/build-dict.mjs [sourcePath] [extraPath] [refinementsPath] [outPath]
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * 合并源词典、补充词典与优化覆盖层。
 * - 源词典值可以是字符串或 { text, nth }，统一取 text
 * - 同一原文多译时取出现次数最多者；平票取先出现者，并记入 conflicts
 * - extra.entries 覆盖内置词条；refinements.entries 最后覆盖（优先级最高）
 * - 输出 entries 按 key 排序
 */
export function buildDictionary(sourceJson, extraJson = {}, refinementsJson = {}) {
  const counts = new Map() // key -> Map<translation, count>
  const modules = sourceJson?.modules ?? {}
  for (const dict of Object.values(modules)) {
    if (!dict || typeof dict !== "object") continue
    for (const [key, value] of Object.entries(dict)) {
      const text = typeof value === "string" ? value : value?.text
      if (!key || typeof text !== "string") continue
      if (!counts.has(key)) counts.set(key, new Map())
      const per = counts.get(key)
      per.set(text, (per.get(text) ?? 0) + 1)
    }
  }

  const entries = {}
  const conflicts = []
  for (const [key, per] of counts) {
    let chosen = null
    let best = -1
    // Map 迭代为插入顺序：同票时先出现者先到，`>` 保证不被后者覆盖
    for (const [text, n] of per) {
      if (n > best) {
        best = n
        chosen = text
      }
    }
    entries[key] = chosen
    if (per.size > 1) {
      conflicts.push({ key, chosen, alternatives: [...per.keys()].filter((t) => t !== chosen) })
    }
  }

  for (const [key, text] of Object.entries(extraJson?.entries ?? {})) {
    if (typeof text === "string") entries[key] = text
  }

  // 优化覆盖层优先级最高
  for (const [key, text] of Object.entries(refinementsJson?.entries ?? {})) {
    if (typeof text === "string") entries[key] = text
  }

  const sorted = {}
  for (const key of Object.keys(entries).sort()) sorted[key] = entries[key]
  return { version: 1, entries: sorted, conflicts }
}

function readOptionalJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    if (e.code === "ENOENT") return {} // 缺失视为空，其它错误照常抛出
    throw e
  }
}

function main() {
  const root = new URL("..", import.meta.url)
  const sourcePath = process.argv[2] ?? fileURLToPath(new URL("dict/zh-CN.json", root))
  const extraPath = process.argv[3] ?? fileURLToPath(new URL("dict/runtime-extra.json", root))
  const refinementsPath = process.argv[4] ?? fileURLToPath(new URL("dict/refinements.json", root))
  const outPath = process.argv[5] ?? fileURLToPath(new URL("dict.json", root))

  const source = JSON.parse(readFileSync(sourcePath, "utf8"))
  const extra = readOptionalJson(extraPath)
  const refinements = readOptionalJson(refinementsPath)

  const result = buildDictionary(source, extra, refinements)
  writeFileSync(outPath, JSON.stringify({ version: result.version, entries: result.entries }, null, 1) + "\n")
  console.log(`已生成 ${outPath}: ${Object.keys(result.entries).length} 条，冲突 ${result.conflicts.length} 个`)
  for (const c of result.conflicts.slice(0, 20)) {
    console.log(`  冲突: ${c.key} -> ${c.chosen}（备选: ${c.alternatives.join(", ")}）`)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) main()
