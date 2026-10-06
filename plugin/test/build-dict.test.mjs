import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buildDictionary } from "../scripts/build-dict.mjs"

const source = JSON.parse(readFileSync(new URL("./fixtures/source.json", import.meta.url), "utf8"))
const extra = JSON.parse(readFileSync(new URL("./fixtures/extra.json", import.meta.url), "utf8"))

test("合并多个模块并处理 {text,nth} 值", () => {
  const r = buildDictionary(source, {})
  assert.equal(r.version, 1)
  assert.equal(r.entries.Settings, "设置")
  assert.equal(r.entries.change, "切换")
})

test("同词多译取最高频并记录冲突", () => {
  const r = buildDictionary(source, {})
  assert.equal(r.entries.Open, "打开")
  const conflict = r.conflicts.find((c) => c.key === "Open")
  assert.ok(conflict, "应记录 Open 的冲突")
  assert.equal(conflict.chosen, "打开")
  assert.deepEqual(conflict.alternatives, ["开启"])
})

test("extra 覆盖内置词条", () => {
  const r = buildDictionary(source, extra)
  assert.equal(r.entries.Settings, "设定")
})

test("refinements 覆盖 runtime-extra 与内置词条", () => {
  const refinements = { entries: { Settings: "系统设置", "新增键": "新值" } }
  const r = buildDictionary(source, extra, refinements)
  assert.equal(r.entries.Settings, "系统设置")
  assert.equal(r.entries["新增键"], "新值")
  assert.equal(r.entries.Open, "打开")
})

test("输出按 key 排序且带 version", () => {
  const r = buildDictionary(source, {})
  const keys = Object.keys(r.entries)
  assert.deepEqual(keys, [...keys].sort())
  assert.equal(r.version, 1)
})
