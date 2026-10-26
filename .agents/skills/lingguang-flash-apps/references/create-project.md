# 新建灵光闪应用

用户要求新建闪应用，或迁移流程需要创建隔离的迁移目标时，完整读取本文档。

## 目录

- [准备环境](#准备环境)
- [macOS 和 Linux 初始化](#macos-和-linux-初始化)
- [Windows 初始化](#windows-初始化)
- [初始化失败处理](#初始化失败处理)
- [开发应用](#开发应用)

## 准备环境

1. 确认应用目标和输出目录。初始化目录必须尚不存在；禁止覆盖已有目录。
2. 检查 `node`、`npm`、Python、`curl` 和 `tar` 是否可用，并输出版本。官方脚手架当前要求 Node.js `^20.19.0` 或 `>=22.12.0`。macOS/Linux 使用 `python3`；Windows 优先使用 Python Launcher `py -3`，没有 Launcher 时使用 `python`。
3. 安装 Node.js 依赖时使用 npmmirror 镜像源 `https://registry.npmmirror.com`，例如 `npm ci --registry=https://registry.npmmirror.com`。
4. 工具缺失或版本不兼容时，明确报告缺失项。安装或升级系统软件前先征得用户同意，再使用用户系统已有的包管理方式处理；禁止静默安装。
5. 说明最终会交付通过检查的 React 源码项目。用户还要求发布时，在完成开发后再按总 Skill 路由进入构建发布阶段。

官方脚手架版本清单：

```text
版本清单：https://agi-static.lingguang.com/developer-react-scaffold.json
下载地址：版本清单 JSON 的 latest 字段
```

由 Agent 动态读取版本清单的 `latest` 字段、下载并解压脚手架；不要要求用户手工下载。不要在技能中固定版本化下载地址或包摘要。

## macOS 和 Linux 初始化

先让用户确认一个尚不存在的新目录，再执行：

```bash
APP_DIR=/absolute/path/to/new-flash-app
SCAFFOLD_MANIFEST_URL="https://agi-static.lingguang.com/developer-react-scaffold.json"
SCAFFOLD_TMP_DIR=$(mktemp -d)
SCAFFOLD_ARCHIVE="$SCAFFOLD_TMP_DIR/developer-react-scaffold.tar.gz"
SCAFFOLD_STAGE_DIR="$SCAFFOLD_TMP_DIR/project"

cleanup_scaffold_tmp() {
  rm -rf -- "$SCAFFOLD_TMP_DIR"
}
trap cleanup_scaffold_tmp EXIT

test ! -e "$APP_DIR" || { echo "目标目录已经存在：$APP_DIR" >&2; exit 1; }
if ! SCAFFOLD_MANIFEST_JSON=$(curl --fail --location --silent --show-error \
  "$SCAFFOLD_MANIFEST_URL"); then
  echo "获取脚手架版本清单失败" >&2
  exit 1
fi
if ! SCAFFOLD_URL=$(
  python3 - "$SCAFFOLD_MANIFEST_JSON" <<PY
import json
import sys
from urllib.parse import urlparse

try:
    value = json.loads(sys.argv[1]).get("latest")
except (AttributeError, json.JSONDecodeError) as exc:
    raise SystemExit(f"版本清单格式无效：{exc}")
parsed = urlparse(value) if isinstance(value, str) else None
if not (parsed and parsed.scheme == "https" and parsed.netloc):
    raise SystemExit("版本清单 latest 字段不是有效的 HTTPS URL")
print(value)
PY
); then
  echo "获取脚手架下载地址失败" >&2
  exit 1
fi
if ! curl --fail --location --show-error "$SCAFFOLD_URL" \
  --output "$SCAFFOLD_ARCHIVE"; then
  echo "脚手架下载失败" >&2
  exit 1
fi

mkdir -p "$SCAFFOLD_STAGE_DIR" "$(dirname "$APP_DIR")"
if ! tar -xzf "$SCAFFOLD_ARCHIVE" -C "$SCAFFOLD_STAGE_DIR"; then
  echo "脚手架解压失败" >&2
  exit 1
fi
for required_path in AGENTS.md package.json src/main.tsx; do
  if [ ! -f "$SCAFFOLD_STAGE_DIR/$required_path" ]; then
    echo "脚手架缺少必要文件：$required_path" >&2
    exit 1
  fi
done
mv "$SCAFFOLD_STAGE_DIR" "$APP_DIR"
```

临时目录必须使用 `trap` 清理。移动项目前必须确认 `AGENTS.md`、`package.json` 和 `src/main.tsx` 均存在。

## Windows 初始化

PowerShell 使用下面的等价流程：

```powershell
$ErrorActionPreference = "Stop"
$AppDir = "C:\absolute\path\to\new-flash-app"
$ScaffoldManifestUrl = "https://agi-static.lingguang.com/developer-react-scaffold.json"
$ScaffoldTempDir = Join-Path ([IO.Path]::GetTempPath()) `
  ("lingguang-scaffold-" + [guid]::NewGuid().ToString("N"))
$ScaffoldArchive = Join-Path $ScaffoldTempDir "developer-react-scaffold.tar.gz"
$ScaffoldStageDir = Join-Path $ScaffoldTempDir "project"

if (Test-Path -LiteralPath $AppDir) {
  throw "目标目录已经存在：$AppDir"
}

try {
  $ScaffoldManifest = Invoke-RestMethod -Uri $ScaffoldManifestUrl
  $ScaffoldUrl = [string]$ScaffoldManifest.latest
  $ParsedScaffoldUrl = $null
  if ([string]::IsNullOrWhiteSpace($ScaffoldUrl) -or
      -not [Uri]::TryCreate($ScaffoldUrl, [UriKind]::Absolute, [ref]$ParsedScaffoldUrl) -or
      $ParsedScaffoldUrl.Scheme -ne "https") {
    throw "版本清单 latest 字段不是有效的 HTTPS URL"
  }

  New-Item -ItemType Directory -Path $ScaffoldStageDir -Force | Out-Null
  Invoke-WebRequest -Uri $ScaffoldUrl -OutFile $ScaffoldArchive

  tar.exe -xzf $ScaffoldArchive -C $ScaffoldStageDir
  if ($LASTEXITCODE -ne 0) {
    throw "脚手架解压失败，tar.exe 退出码：$LASTEXITCODE"
  }

  foreach ($RequiredPath in @("AGENTS.md", "package.json", "src\main.tsx")) {
    if (-not (Test-Path -LiteralPath (Join-Path $ScaffoldStageDir $RequiredPath) -PathType Leaf)) {
      throw "脚手架缺少必要文件：$RequiredPath"
    }
  }

  $AppParent = Split-Path -Parent $AppDir
  New-Item -ItemType Directory -Path $AppParent -Force | Out-Null
  Move-Item -LiteralPath $ScaffoldStageDir -Destination $AppDir
} finally {
  if (Test-Path -LiteralPath $ScaffoldTempDir) {
    Remove-Item -LiteralPath $ScaffoldTempDir -Recurse -Force
  }
}
```

## 初始化失败处理

获取版本清单、解析 `latest`、下载、解压或必要文件检查失败时，报告具体错误并停止初始化。禁止擅自改用 `master`、其他仓库副本或不来自版本清单 `latest` 字段的压缩包。脚手架版本由版本清单维护。

## 开发应用

1. 完整读取解压后项目中的 `AGENTS.md`。
2. 只读取当前功能需要的 `docs/API_*.md`。
3. 运行 `npm ci --registry=https://registry.npmmirror.com`。只使用 `package.json` 中已经声明的依赖。
4. 编写业务代码，但不要修改平台维护的 `src/main.tsx`。
5. 在项目根目录创建并维护 `manifest.json`。以脚手架中的 `plugins/manifest-utils.ts` 和 `plugins/vite-plugin-validate-manifest.ts` 为当前字段、封面格式及路径规则的事实来源，不要凭记忆臆造 schema。
6. 完成主要功能后，如用户要求构建、质检、打包或发布，再按总 Skill 路由读取 `build-and-release.md`；不要在开发阶段提前加载发布流程。
