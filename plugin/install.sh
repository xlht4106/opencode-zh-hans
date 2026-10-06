#!/bin/sh
# 安装汉化插件到 opencode 全局插件目录（自动发现，无需改配置）。
set -e
cd "$(dirname "$0")"

DEST="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins/zh-hans"

rm -rf "$DEST"
mkdir -p "$DEST"
cp package.json tui.js translate.js dict.json "$DEST/"

echo "已安装到 $DEST"
echo "重启 opencode 后生效。"
echo "卸载：rm -rf \"$DEST\""
