# 构建、打包与发布

用户要求质检、构建、打包、预览发布或正式发布时，完整读取本文档。首次实际调用发布接口、查询发布状态或排查接口响应时，再完整读取 `deploy-api.md`。

## 目录

- [准备环境](#准备环境)
- [准备应用封面](#准备应用封面)
- [发布前强制质检](#发布前强制质检)
- [打包源码](#打包源码)
- [配置认证信息](#配置认证信息)
- [发布与查询](#发布与查询)
- [应用身份与常见错误](#应用身份与常见错误)

## 准备环境

先把总 `SKILL.md` 所在目录记为 `SKILL_DIR`。检查 `node`、`npm`、Python 和 `tar` 是否可用，并输出版本。官方脚手架当前要求 Node.js `^20.19.0` 或 `>=22.12.0`；发布脚本要求 Python `>=3.10` 和 `qrcode==8.2`。

macOS/Linux 使用 `python3`，Windows 优先使用 Python Launcher `py -3`，没有 Launcher 时使用 `python`。用当前解释器运行 `-c "from importlib.metadata import version; assert version('qrcode') == '8.2'"` 检查二维码依赖；缺失或版本不符时暂停并征得用户同意，再用同一解释器运行 `-m pip install -r requirements.txt`。

安装 Node.js 依赖时使用 npmmirror 镜像源 `https://registry.npmmirror.com`。工具缺失或版本不兼容时，明确报告缺失项；安装或升级系统软件前先征得用户同意，禁止静默安装。

`scripts/flashapp_api.py` 第一行的 `#!/usr/bin/env python3` 在 Windows 上只会被 Python 当作注释，不影响运行；不要在 PowerShell 中直接执行脚本文件，使用 `py -3 scripts\flashapp_api.py ...`，没有 `py` 命令时使用 `python scripts\flashapp_api.py ...`。

Windows 原生路径：

- 访问令牌配置：`%APPDATA%\lingguang-flash-apps\config.json`
- 自动生成的二维码：`%LOCALAPPDATA%\lingguang-flash-apps\qrcodes\`

脚本仍兼容旧位置 `~/.config/lingguang-flash-apps/config.json`：Windows 原生配置不存在时会自动回退读取旧配置。Windows 不执行 POSIX `0600` 权限检查，令牌文件应只保存在当前用户可访问的目录中；也可以使用当前 PowerShell 会话的 `$env:LINGGUANG_FLASH_APPS_ACCESS_TOKEN`。

Windows 检查和安装二维码依赖：

```powershell
$SkillDir = "C:\absolute\path\to\lingguang-flash-apps"
py -3 --version
py -3 -c "from importlib.metadata import version; assert version('qrcode') == '8.2'"
py -3 -m pip install -r (Join-Path $SkillDir "requirements.txt")
```

只在用户同意安装依赖后执行最后一条命令。

## 准备应用封面

脚手架自带默认封面，且 `manifest.json` 中的 `artifact.coverImage` 已指向该文件。默认封面只作为兜底，不要把它默认为最终交付效果。

完成应用主要功能后、预览发布前，主动告知用户可以上传自己的封面，并鼓励用户提供与应用主题匹配的专属封面；用户没有现成图片时，主动建议根据应用名称、用途和视觉风格生成一张专属封面。用户愿意提供或生成时，把最终图片保存到源码项目中，更新 `artifact.coverImage` 为源码包内的相对路径，并向用户展示封面供确认。用户暂时不提供且不要求生成时，保留脚手架默认封面，不阻塞后续流程。

打包前确认 `artifact.coverImage` 指向的图片真实存在并会随源码包上传。封面格式及路径限制始终以当前脚手架的 manifest 工具和校验插件为准，禁止使用远程 URL 或只存在于源码包外的本地路径。

## 发布前强制质检

每次预览发布前，必须由 Agent 自行完成本节全部检查。发现原因明确、影响范围小且不改变用户需求或产品行为的简单问题时，可以直接修复并重新检查，在质检结果中向用户说明修复内容。涉及功能取舍、产品行为变化、数据风险、新增依赖或扩大任务范围时，先向用户说明问题、影响和修复建议，取得确认后再修改。禁止要求用户运行命令、阅读源码或代替 Agent 判断是否合格。任何检查未执行、无法执行、结果失败或仍有待用户确认的问题时，都必须停止，不得打包、预览发布或正式发布。

1. **规范与改动审查**：重新完整读取项目 `AGENTS.md` 和本次功能涉及的 `docs/API_*.md`，检查 Git 状态和全部改动文件，并逐项核对规范。确认 `src/main.tsx` 未被业务代码覆盖，组件已合理拆分，交互控件包含要求的 `data-testid`，跨目录导入、图片、音频、存储、浏览器 API、远程资源和密钥处理均符合规范。禁止只以构建成功代替规范核对。
2. **样式质检**：检查本次新增或修改的样式。确认优先使用 Tailwind、自定义 CSS 确有必要；安全区使用写在 CSS 中的 `env(safe-area-inset-*, 0px)`；靠近屏幕边缘的 `fixed` 或 `absolute` 可交互元素叠加正确方向的安全区；不存在 Google Fonts、远程 CSS 导入、无效资源路径、明显的横向溢出、内容遮挡或与 `manifest.json` 方向不一致的问题。
3. **依赖与锁文件质检**：检查 `package.json`、锁文件及其 Git diff。禁止添加脚手架未声明的依赖，禁止同一包同时出现在 `dependencies` 和 `devDependencies`，禁止直接导入未声明包或传递依赖。扫描本次新增和修改的 import；本次改动新增但未实际使用的依赖必须移除。脚手架预置的依赖是平台允许列表，不得仅因当前业务未使用就批量删除。运行 `npm ci --registry=https://registry.npmmirror.com` 和 `npm ls --depth=0`，缺失、无效或意外多出的依赖都必须修复。
4. **格式与自动化门禁**：先运行 `npm run format:check`。失败时运行 `npm run format`，检查格式化造成的改动并重新运行 `npm run format:check`。随后运行 `npm run check`，确保 lint、严格类型检查和生产构建全部通过且没有警告被绕过。禁止修改脚本、配置或规则来规避失败。
5. **Manifest、封面与源码包检查**：确认根目录 `manifest.json` 字段完整、`artifact.versionDescription` 已按本次变更更新、封面文件存在且会进入源码包。确认源码包根目录包含 `package.json` 和 `manifest.json`，且不包含 `.git`、`node_modules`、`dist`、`.env*`、密钥、`flashapp-artifact.json` 或压缩包自身。
6. **记录结果**：在发起预览发布前，向用户简要列出以上各项的执行结果、发现的问题、已完成的修复和仍待用户确认的事项。只有全部项目明确通过时，才允许进入“打包源码”和“发布与查询”。

正式发布必须复用已经通过上述质检和用户确认的同一源码包。正式发布前核对源码包摘要未变化；只要源码、依赖、配置、资源或源码包发生变化，就必须重新执行全部质检、重新预览并再次等待用户确认。

## 打包源码

仅在“发布前强制质检”全部通过后，在项目目录外创建压缩包，避免把压缩包自身包含进去：

```bash
tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.DS_Store' \
  --exclude='.env*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='flashapp-artifact.json' \
  -czf /tmp/flash-app-source.tar.gz .
```

确保 `package.json` 和 `manifest.json` 位于压缩包根目录。发布脚本会拒绝危险路径、软硬链接、应排除的目录、疑似密钥文件、缺少根目录必要文件的压缩包以及无效的 tar 压缩包。

Windows PowerShell 可使用系统自带的 `tar.exe`，并从项目根目录打包：

```powershell
$ProjectDir = "C:\absolute\path\to\my-flash-app"
$Package = Join-Path $env:TEMP "flash-app-source.tar.gz"
Push-Location $ProjectDir
try {
  tar.exe --exclude=.git --exclude=node_modules --exclude=dist `
    --exclude=.DS_Store --exclude=.env* --exclude=*.pem --exclude=*.key `
    --exclude=flashapp-artifact.json -czf $Package .
} finally {
  Pop-Location
}
```

## 配置认证信息

首次发布前必须暂停后续发布步骤，确保访问令牌已经配置完成。未配置或尚未确认时，主动向用户提供以下两种方式：

1. **由 Agent 配置**：允许用户把访问令牌直接发送到聊天中。收到后不要在回复中复述或展示令牌；去掉可选的 `Bearer ` 前缀。macOS/Linux 写入 `~/.config/lingguang-flash-apps/config.json` 并把权限设置为 `0600`；Windows 写入 `%APPDATA%\lingguang-flash-apps\config.json`，不运行 `chmod`。使用不会把令牌显示在终端命令、补丁、stdout、stderr 或日志中的写入方式。完成后只确认“访问令牌已配置”，不要输出文件内容或令牌值。
2. **由用户配置**：让用户按下面的命令复制模板，自行替换占位值并设置文件权限；用户确认完成后再继续。

macOS/Linux：

```bash
SKILL_DIR=/absolute/path/to/lingguang-flash-apps
mkdir -p ~/.config/lingguang-flash-apps
cp "$SKILL_DIR/assets/config.example.json" ~/.config/lingguang-flash-apps/config.json
chmod 600 ~/.config/lingguang-flash-apps/config.json
```

Windows PowerShell：

```powershell
$SkillDir = "C:\absolute\path\to\lingguang-flash-apps"
$ConfigDir = Join-Path $env:APPDATA "lingguang-flash-apps"
New-Item -ItemType Directory -Force $ConfigDir | Out-Null
Copy-Item (Join-Path $SkillDir "assets\config.example.json") `
  (Join-Path $ConfigDir "config.json")
notepad (Join-Path $ConfigDir "config.json")
```

访问令牌从 <https://www.lingguang.com/settings> 获取，也可以由用户自行设置环境变量 `LINGGUANG_FLASH_APPS_ACCESS_TOKEN`。配置后，macOS/Linux 验证文件存在、权限为 `0600`、JSON 结构有效且令牌不是占位值；Windows 验证文件位于当前用户的 `%APPDATA%`、JSON 结构有效且令牌不是占位值，不验证 POSIX 权限位。禁止在验证结果中显示令牌。

允许在聊天中接收访问令牌，但禁止通过 CLI 参数传递，禁止把它写入源码、提交记录或发布包，也禁止打印或复制到诊断日志中。禁止保存或发送浏览器中的 Cookie、UA 或 `sec-*` 请求头。

## 发布与查询

相对于总 `SKILL.md` 定位 `scripts/flashapp_api.py`。需要查看全部命令参数时，运行 `--help`。

`release --preview` 会在 API 请求中发送 `preview=true`，用于预览发布。不传 `--preview` 时请求中完全省略 `preview` 字段，属于正式发布。`--new-artifact` 只控制新建还是更新应用，不代表发布模式。

标准流程必须先完成“发布前强制质检”，再预览、展示结果并等待用户确认，最后才能正式发布：

| 阶段 | 发布参数 | 应用身份处理方式 |
|---|---|---|
| 首次预览 | `--preview --new-artifact` | 不传 `artifactId`，创建新应用 |
| 更新预览 | `--preview` | 复用 `flashapp-artifact.json` 中的 `artifactId` |
| 正式发布 | 不传 `--preview` 和 `--new-artifact` | 复用已通过预览的 `artifactId` |
| 查询发布 | 使用本次发布的 `instanceId` | 仅在状态为 `PASS` 时生成成功摘要、二维码并保存身份 |

首次预览发布：

```bash
python3 "$SKILL_DIR/scripts/flashapp_api.py" release \
  --package /tmp/flash-app-source.tar.gz \
  --project-dir /path/to/my-flash-app \
  --preview \
  --new-artifact
```

从标准输出中取得 `result.instanceId`，然后查询该发布实例：

```bash
python3 "$SKILL_DIR/scripts/flashapp_api.py" query \
  --instance-id INSTANCE_ID \
  --project-dir /path/to/my-flash-app \
  --preview
```

查询命令的发布类型必须与对应发布请求一致：预览发布查询必须传 `--preview`，正式发布查询不得传 `--preview`。

Windows PowerShell 对应的首次预览与查询命令如下；正式发布时省略 `--preview` 和 `--new-artifact`。以下 `py -3` 在没有 Python Launcher 时均可替换为 `python`：

```powershell
$SkillDir = "C:\absolute\path\to\lingguang-flash-apps"
$ProjectDir = "C:\absolute\path\to\my-flash-app"
$Package = Join-Path $env:TEMP "flash-app-source.tar.gz"

py -3 (Join-Path $SkillDir "scripts\flashapp_api.py") release `
  --package $Package --project-dir $ProjectDir --preview --new-artifact

py -3 (Join-Path $SkillDir "scripts\flashapp_api.py") query `
  --instance-id INSTANCE_ID --project-dir $ProjectDir --preview
```

如果返回状态不是 `PASS`，以固定且有限的间隔继续查询同一个 `instanceId`，每 10 秒一次、最多等待 10 分钟。达到等待上限时，报告当前状态和 `instanceId`，不要重复提交发布请求。

查询返回失败状态时，直接读取响应中返回的具体失败原因，不要查找或下载远程报错文件。Agent 必须根据失败原因排查：简单问题可以直接修复并向用户说明；涉及功能取舍、产品行为变化、数据风险、新增依赖或扩大任务范围时，先向用户说明影响和修复建议，取得确认后再修改。修复完成后重新执行全部强制质检并重新发起预览发布。

状态为 `PASS` 后，查询输出会移除 API 原始 `packageUrl`，并新增 `releaseSummary`，包含 `name`、`artifactId`、`artifactVersion`、`releaseType` 和 `qrCodePath`；正式发布还包含 `viewHint`。二维码在 macOS/Linux 默认生成于 `~/.cache/lingguang-flash-apps/qrcodes/`，Windows 默认生成于 `%LOCALAPPDATA%\lingguang-flash-apps\qrcodes\`；需要指定路径时给查询命令传入 `--qr-output` 和一个以 `.svg` 结尾的绝对路径。

二维码不得直接编码 API 返回的原始 URL。脚本会对原始 URL 连续执行两次与 JavaScript `encodeURIComponent` 一致的百分号编码，再拼入灵光 App 的 `leopards://` 闪应用详情深链，最终把完整深链编码进二维码。以脚本中的 `build_qr_target_url()` 为规则事实来源，不要自行拼接或只编码一次。

每次查询到 `PASS` 都必须向用户同时展示：

- 应用名称
- 应用 ID（`artifactId`）
- 版本号（`artifactVersion`）
- 使用 `qrCodePath` 绝对路径渲染的二维码图片，并紧邻二维码明确提醒：“请使用灵光 App 扫码访问”

预览发布只展示二维码和上述基本信息，禁止向用户提供 API 返回的原始 URL。交付预览二维码时，必须紧邻二维码明确提醒：“预览链接有效期为 10 分钟，10 分钟后将失效，请尽快使用灵光 App 扫码验证。”二维码交付后，本次预览发布即结束；必须暂停并明确等待用户确认预览没有问题。未得到确认时，禁止自动提交正式发布。

用户确认后，使用同一源码包和已保存的应用身份正式发布：

```bash
python3 "$SKILL_DIR/scripts/flashapp_api.py" release \
  --package /tmp/flash-app-source.tar.gz \
  --project-dir /path/to/my-flash-app
```

正式发布同样要使用新的 `instanceId` 查询到 `PASS`，查询时不得传 `--preview`。向用户交付正式版本的名称、应用 ID、版本号和二维码，提醒二维码须使用灵光 App 扫码，并告知：“可前往灵光 App 或网页版「我的创作」查看。”不要向用户提供 API 返回的原始 URL。完成二维码和查看方式交付后，整个发布流程即结束；不要继续查询该 `instanceId`，也不要再提交发布请求。

## 应用身份与常见错误

查询为 `PASS` 时，命令会把稳定的应用身份写入项目根目录的 `flashapp-artifact.json`。该文件应纳入应用自己的 Git 仓库，但不要放进发布压缩包；只有用户授权提交时才执行 `git commit`。后续发布不要传 `--new-artifact`，脚本会自动复用保存的 `artifactId`。

如果查询返回不同的 ID，先排查原因，再决定是否使用 `--replace-artifact-id`。只有明确要更换项目的应用身份时才能使用该参数。

- 禁止只根据 HTTP 200 判断成功；还必须检查 JSON 中的业务字段。
- 禁止把 `--new-artifact` 当作预览开关；只有 `--preview` 控制预览发布。
- 禁止在用户确认预览前省略 `--preview`；省略该参数就是正式发布。
- 禁止把预览发布的查询当作正式查询；预览查询必须传 `query --preview`。
- 禁止展示 API 返回的原始 `packageUrl`，也禁止直接把原始 URL 编码成二维码。
- 禁止把 `instanceId` 当作稳定应用身份；只有 `artifactId` 是稳定身份。
- 禁止在 `flashapp-artifact.json` 中保存版本、状态、预览 URL、trace ID、访问令牌或 Cookie。
- 禁止上传 `dist`；发布接口需要通过检查的源码包。
- 禁止把 React 脚手架放入技能分发包。
