import test from "node:test"
import assert from "node:assert/strict"
import { createTranslator, parseDictionary } from "../translate.js"

test("精确匹配翻译", () => {
  const t = createTranslator({ Settings: "设置" })
  assert.equal(t.translate("Settings"), "设置")
})

test("不做部分匹配", () => {
  const t = createTranslator({ Settings: "设置" })
  assert.equal(t.translate("Settings..."), "Settings...")
  assert.equal(t.translate("Set"), "Set")
})

test("overrides 优先", () => {
  const t = createTranslator({ Settings: "设置" }, { Settings: "设定" })
  assert.equal(t.translate("Settings"), "设定")
})

test("非字符串输入原样返回", () => {
  const t = createTranslator({ Settings: "设置" })
  assert.equal(t.translate(undefined), undefined)
  assert.equal(t.translate(123), 123)
})

test("applyChunks 只处理字符串 text", () => {
  const t = createTranslator({ Exit: "退出" })
  const chunks = [{ text: "Exit" }, { text: undefined }, null, { text: 123 }]
  assert.equal(t.applyChunks(chunks), 1)
  assert.equal(chunks[0].text, "退出")
})

test("applyChunks 对非数组输入返回 0", () => {
  const t = createTranslator({ Exit: "退出" })
  assert.equal(t.applyChunks(undefined), 0)
  assert.equal(t.applyChunks({ chunks: [] }), 0)
})

test("createTranslator 暴露 size", () => {
  const t = createTranslator({ A: "甲", B: "乙" })
  assert.equal(t.size, 2)
})

test("parseDictionary 拒绝非法形状", () => {
  assert.throws(() => parseDictionary({}))
  assert.throws(() => parseDictionary({ entries: { a: 1 } }))
})

test("parseDictionary 接受合法形状", () => {
  assert.deepEqual(parseDictionary({ version: 1, entries: { a: "甲" } }), { a: "甲" })
})
