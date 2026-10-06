#!/usr/bin/env node
// 审计巡检：在独立 tmux socket 中启动原版二进制 + 汉化插件（audit 模式），
// 依次访问主要界面并截图，最后汇总未命中的英文渲染文本。
//
// 用法: node plugin/scripts/audit.mjs [输出目录，默认 plugin/audit]
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
const outDir = resolve(process.argv[2] ?? join(root, "plugin/audit"))
const shotsDir = join(outDir, "shots")
const pluginDir = join(root, "plugin")
const binary = join(process.env.HOME ?? "", ".opencode", "bin", "opencode.orig-v2.0.24")
const auditLog = "/tmp/zh-hans-audit.log"
const SOCKET = "zh-audit"
const SESSION = "zh-audit"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function tmux(...args) {
  return execFileSync("tmux", ["-L", SOCKET, ...args], { encoding: "utf8" })
}

function tmuxQuiet(...args) {
  try {
    return execFileSync("tmux", ["-L", SOCKET, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return ""
  }
}

async function capture(name) {
  await sleep(300)
  const text = tmux("capture-pane", "-p", "-t", SESSION)
  writeFileSync(join(shotsDir, `${name}.txt`), text)
  console.log(`  截图 ${name}.txt`)
}

async function main() {
  if (!existsSync(binary)) {
    console.error(`找不到原版二进制: ${binary}`)
    process.exit(1)
  }
  mkdirSync(shotsDir, { recursive: true })
  rmSync(auditLog, { force: true })
  tmuxQuiet("kill-server")

  const env = `OPENCODE_CLI_CONFIG_CONTENT='{"plugins":[{"package":"${pluginDir}","options":{"audit":true}}]}'`
  tmux("new-session", "-d", "-s", SESSION, "-x", "120", "-y", "36")
  await sleep(500)
  tmux("send-keys", "-t", SESSION, `cd /tmp && ${env} ${binary} --standalone`, "Enter")
  await sleep(16000)

  await capture("01-home")
  tmux("send-keys", "-t", SESSION, "C-p")
  await sleep(2500)
  await capture("02-palette")
  tmux("send-keys", "-t", SESSION, "Down")
  await sleep(800)
  tmux("send-keys", "-t", SESSION, "Enter")
  await sleep(2500)
  await capture("03-settings")
  tmux("send-keys", "-t", SESSION, "Escape")
  await sleep(800)
  tmux("send-keys", "-t", SESSION, "C-x")
  await sleep(600)
  tmux("send-keys", "-t", SESSION, "m")
  await sleep(2500)
  await capture("04-models")
  tmux("send-keys", "-t", SESSION, "Escape")
  await sleep(800)
  tmux("send-keys", "-t", SESSION, "C-x")
  await sleep(600)
  tmux("send-keys", "-t", SESSION, "l")
  await sleep(2500)
  await capture("05-sessions")
  tmux("send-keys", "-t", SESSION, "C-a") // 切到“所有项目”，确保有会话可打开
  await sleep(2500)
  await capture("05b-all-sessions")
  let opened = false
  for (let attempt = 0; attempt < 3 && !opened; attempt++) {
    tmux("send-keys", "-t", SESSION, "Enter")
    await sleep(3000)
    const text = tmux("capture-pane", "-p", "-t", SESSION)
    opened = !text.includes("没有可用会话")
  }
  await capture("06-session")

  tmux("send-keys", "-t", SESSION, "C-c")
  await sleep(1500)
  tmuxQuiet("kill-server")

  // 汇总未命中文本
  const lines = existsSync(auditLog)
    ? readFileSync(auditLog, "utf8").split("\n").filter((l) => l.trim().length > 0)
    : []
  const counts = new Map()
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1)
  const unmatched = [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.text.length - a.text.length)
  writeFileSync(join(outDir, "unmatched.json"), JSON.stringify(unmatched, null, 1) + "\n")

  console.log(`巡检完成：截图 ${existsSync(shotsDir) ? "已生成" : "缺失"}，未命中 ${unmatched.length} 条 -> ${join(outDir, "unmatched.json")}`)
}

main().catch((e) => {
  console.error(e)
  tmuxQuiet("kill-server")
  process.exit(1)
})
