# dsh-style-tweaks

> 依赖版本：deepseek-harness v0.1.2-rc.1

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web UI 插件：为 DSH 界面提供一套可选的样式调整——精确的对话列宽控制，以及侧边栏与设置面板的一系列小幅度修复。

## 功能

### 布局

- **插件宽度控制**（默认开启）：开启时插件自带的列宽输入 / 预设接管列宽，并隐藏 DSH 原生的拖拽手柄；关闭时原生手柄接管列宽，插件同步显示当前值。
- **对话框宽度**：600–1600 px 之间任意值；含 748（默认）/ 880（稍宽）/ 1024（更宽）三个预设按钮。
- **两侧边距**：对话区域两侧保留的空白（px），列宽被钳制为对话框宽度，侧边栏打开或窗口缩小时内容会收窄，不会贴住边缘。最低 32 px。

### 调整项

- **表格布局稳定（默认开启）**：锁住 markdown 表格 hover 时的布局，避免周围内容发生回流（"鼠标移到表格上时下方文本会跳动"）。
- **轮次导航栏稳定（默认开启）**：向上滚动到第一条消息上方的系统提示词区域时，让右侧轮次导航栏保持在原位（不再下移约 16 像素）。
- **代码块顶部贴齐（默认开启）**：去掉高亮代码块上方的 16 px 空白，让代码块紧贴在前面的段落、列表项或标题下方。
- **项目目录运行指示（默认开启）**：在侧边栏项目目录右侧显示与对话标题一致的运行动画圆点，目录收起时也能一眼看出里面有对话正在进行。
- **定位当前会话（默认开启）**：在侧边栏"工作区"段头部的搜索按钮左边新增一个定位按钮；点击后自动展开当前会话所属的工作区目录（包括"展开其余 x 个会话"的折叠层），将该会话滚动到侧边栏视口中央。无当前会话时按钮禁用并提示"请先打开一个会话"。
- **设置菜单可滚动（默认开启）**：设置项较多时，让设置面板左侧菜单可以上下滚动，而不是把放不下的项直接裁掉（面板高度固定且 `overflow: hidden`，原生样式只给右侧内容列加了滚动）。滚动条为悬浮式细条：停靠在菜单右侧的留白里、不挤压菜单宽度，只在列表实际滚动时出现，停止滚动约 0.8 秒后淡出。
- **经典统计行（默认关闭）**：DSH 0.1.5 起，输入框下方的统计信息从一行居中文本（轮数/步数 · 耗时 · 速度 · 缓存命中 · Token 用量）改成了两个图标胶囊（点开弹窗查看）。开启本项可恢复 0.1.2 的文本行样式：数据仍读同一批持久化投影（`sessionStats` / `tokenUsage`），数值与胶囊一致，超宽时省略号截断、悬停显示完整内容；关闭后立即恢复新版胶囊。
- **缓存命中两位小数（默认关闭）**：统计信息的缓存命中率按两位小数显示（如 87.35%），不再取整；点开的 Token 用量弹窗同步生效。无论统计信息以新版图标胶囊还是经典文本行展示，均适用；两个开关同时为开时由经典统计行生效。

```yaml
style-tweaks:
  # 布局
  usePluginWidth: true   # 默认 true；false 时由原生拖拽手柄接管
  dialogWidth: 748       # 600–1600 px
  sideMargin: 50         # ≥ 32 px
  # 调整项
  stableTable: true             # 默认 true；false 则关闭
  stableTurnRail: true          # 默认 true；false 则关闭
  codeBlockFlushTop: true       # 默认 true；false 则关闭
  projectRunningIndicator: true # 默认 true；false 则关闭
  locateCurrentSession: true    # 默认 true；false 则隐藏侧边栏定位按钮
  settingsNavScroll: true       # 默认 true；false 则关闭设置左侧菜单滚动
  legacyStatsLine: false        # 默认 false；true 则用 0.1.2 的文本统计行替换新版胶囊
  pillsCacheHitDecimals: false  # 默认 false；true 则缓存命中率显示两位小数（胶囊与经典行均适用）
```

设置入口：**设置 → 样式调整**。

## 安装

```bash
# 方式一：从 npm 安装（推荐，预构建产物）
npx -y @deepseek-ai/dsh plugin --profile web add dsh-style-tweaks

# 方式二：从 GitHub 仓库安装（源码，会运行自包含的 prepare 构建）
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-style-tweaks
```

`add` 后面的包说明会**原样转发给 pnpm**，因此可以指定版本——npm 包用 `@版本号`，GitHub 源码用 `#tag`：

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-style-tweaks@0.1.0                    # 锁定 npm 版本
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-style-tweaks#v0.1.0     # 锁定 git tag
```

安装完成后**重启一次 `dsh web`**（bundle 插件在进程启动时扫描）。

## 开发

### 构建

```bash
pnpm install
pnpm build          # tsc（服务端）+ tsc（客户端）+ 打包 lib/client.js
pnpm typecheck
```

本地加载（覆盖层）或作为 bundle 安装：

```bash
npx -y @deepseek-ai/dsh web --patch ./cordis.patch.yml   # 开发覆盖层
npx -y @deepseek-ai/dsh plugin --profile web add .        # 从本目录作为 bundle 安装
```

### 热重载（免安装）

构建产物只有客户端插件（`lib/client.js`）需要被 DSH 运行时加载。每次修改代码后：

1. **构建**：
   ```bash
   pnpm build
   ```

2. **复制到 profile 目录**：
   ```bash
   cp lib/client.js ~/.dsh/profiles/web/node_modules/dsh-style-tweaks/lib/client.js
   ```

3. **DSH 的 client-plugin HMR receiver** 会检测文件变更并自动重新加载插件，无需重新安装。

> 注意：有时 GUI 进程会缓存旧 bundle，表现为改动未生效。此时需要重启 `dsh web` 进程。

只有客户端插件（`client.js`）支持热重载。修改 `apps/web` shell 或普通 package 后仍需重新构建 Web 产物并刷新页面。

## 工作原理

- **服务端**（`src/index.ts`）：注册 `style-tweaks` 设置命名空间，并挂载同源路由 `/_dsh/style-tweaks/settings`。
- **浏览器端**（`src/client/index.tsx`）：读写该路由、渲染设置页，并根据每个开关的状态实时挂载 / 卸载对应的调整项（纯 CSS 调整项注入运行时 `<style>` 元素；JS 级调整项还会读写应用自身的状态 store 并修补 DOM）。
- **列宽样式引擎**（`src/client/conversation-width.ts`）：写入 `--dsh-chat-user-width` CSS 变量，并在插件接管列宽时隐藏原生 `[data-width-handle]` 拖拽手柄；宽度值同时镜像到原生手柄读取的 localStorage 槽位，开关切换时无缝往返。
- **调整项注册表**（`src/client/tweaks/registry.ts`）：每个调整项的元数据（id、settings 字段名、默认值、i18n 键）集中登记；新增调整项只需在注册表里加一条，并在 `src/client/tweaks/` 下新增一个注入文件。
- **项目目录运行指示**（`src/client/tweaks/project-running-indicator.ts`）：从 `ctx.get('sessions')` / `ctx.get('workspaces')` 读取会话运行状态与目录归属，用 MutationObserver 在项目目录头行（`role="treeitem"[aria-expanded]`，稳定手写属性）内挂载应用自身的 `StateDot`（复用 `@deepseek-ai/dsh-client-ui-primitives` 的同一份模块，动画 keyframes 与样式 token 与对话标题处完全一致）。
- **定位当前会话**（`src/client/tweaks/locate-current-session.ts`）：在 DSH 侧边栏"工作区"段头部的搜索按钮左边注入一个新按钮。锚点全部走 i18n 与语义片段：通过 `ctx.locale.bind()` 解析当前语言的搜索按钮 aria-label（`workspace` 命名空间的 `search.sessions.aria` 键）与顶部面包屑的 aria-label（`conversation` 命名空间的 `session.hierarchy` 键），locale 服务不可用时退回 `[class*="searchButton"]` / `[class*="crumbs"]` 语义片段兜底。点击后从面包屑（`button[disabled]` 的当前项）读出会话标题，用 `ctx.get('sessions')` 与 `ctx.get('workspaces')` 两个应用级 store 反查所在工作区标题（即使其工作区目录收起也能定位），再按标题匹配工作区行；依次穿透两级折叠——工作区收起时 click 展开、"展开其余 x 个会话"溢出按钮（`[class*="sessionOverflowButton"][aria-expanded="false"]`）挡住目标行时自动点开——然后 `scrollIntoView({ block: 'center' })` 滚动居中。悬停提示复刻了 DSH 原生 `<Tooltip>` 的自研气泡（fixed 定位 + 主题 token + 500ms 延迟 + 视口翻转），而非浏览器原生 `title`。MutationObserver 监听 `aria-selected` / `aria-expanded` 属性变化同步按钮可用性与挂载状态。
- **设置菜单可滚动**（`src/client/tweaks/settings-nav-scroll.ts`）：DSH 设置面板（`SettingsRoot`）高度固定且 `overflow: hidden`，原生样式只让右侧内容列（`.options`）滚动；左侧菜单列表 `.navList` 没有 `min-height: 0` 与 overflow 处理，条目多时被面板直接裁掉。本调整项用"两条 CSS 规则 + 一个小型 JS 驱动"实现：基础规则 `flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 12px; margin-inline-end: -12px` 让列表成为滚动容器，并把滚动条"停靠"进导航栏右侧的 12px 留白里（8px 间距 + 4px 条位，恰好占满留白），滑块悬浮在留白上、与菜单项保持 8px 间距；菜单项上限 `max-width: 164px`（DSH 原生 188 导航 − 2×12 padding）钉住原生宽度，无论滚动条出现与否、悬停还是滚动，菜单项都与原生完全同宽；`::-webkit-scrollbar { width: 4px }` 比全局皮肤细两档。显示时机由 JS 驱动：第一版用 `:not(:hover)` 隐藏滑块，但 Chromium 在宿主 `:hover` 变化时不会可靠重绘自定义滚动条伪元素（实测表现为"点击菜单才出现"），因此改为监听列表 `scroll` 事件——滚动时给列表加 `cst-nav-scroll-show` 类显示滑块（颜色沿用面板继承的 l2 主题 token），停止滚动约 0.8 秒后移除类淡出；MutationObserver 在设置弹窗卸载/重开时保持监听器挂在当前列表上。选择器用"弹窗结构 + CSS Modules 语义片段"双保险（DSH 类名按 `[hash]_[local]` 哈希，`navList` 局部名全 DSH 唯一），无需 `!important`。
- **经典统计行**（`src/client/tweaks/legacy-stats-line.tsx`）：0.1.5 起 DSH 把输入框下方的统计行（旧 `StatsLine`）换成了图标胶囊（新 `StatsPills`），两者挂载方式相同——`conversation.composer.dock` 列表槽位上 id 为 `stats` 的条目。列表槽位的规则是同一 id（同一"格"）里 priority 最低的存活条目渲染，因此本调整项在开关打开时用 `id: 'stats'` + `priority: -2` 影子覆盖原生条目（走槽位系统自己的遮蔽机制，无需 CSS 隐藏或 DOM 修补；它比"缓存命中两位小数"的 `priority: -1` 更优先，见下条），销毁注册即把格子还给原生胶囊；若条目渲染崩溃会自动退位，胶囊原样回来。数据面与新胶囊一致：读 `sessionStats`（整段日志的轮数/步数/耗时）与 `tokenUsage`（计费桶）两个持久化投影，不再做旧版"可见窗口折叠"的兜底（无投影时整行不渲染，符合旧行"无数据不出行"的规则）。文案走插件自己的 `style-tweaks` 命名空间（`legacyStats.*` 键）——旧版 `stats.llm` 系列键在 0.1.5 的词典里已被删除，插件自带中英文案；行样式（居中、三级文字色、省略号截断）按 0.1.2 的 `StatsLine.module.css` 移植，token 全部沿用原值并带兜底。行根元素带 `data-composer-stats` 标记：宿主 InputBar 会围绕任何挂载的统计行把自己的 8px 底距收紧到 4px（`.root:has([data-composer-stats])`），行本身底部补 2px 使总高与胶囊行（26px 行 + 4px 宿主底距）一致——开关切换时对话内容不再上下位移。缓存命中率的小数位数跟随"缓存命中两位小数"开关：开启时按两位小数，关闭时按 0.1.2 原样取整；该开关在挂载时捕获，任何设置变化都会重挂载全部调整项，因此始终即时生效。
- **缓存命中两位小数**（`src/client/tweaks/pills-cache-hit-decimals.tsx`）：新胶囊的命中率取整发生在 dsh-client-ui-chat 模块内部的格式化函数里，插件无法触及，因此本调整项在开关打开时对同一个 `stats` 槽位格做影子替换（`priority: -1`），由插件自绘整行——两个胶囊与点开弹窗按 0.1.5 的 `StatsPills` / `stat-dialog` 逐样式移植（定位与外点关闭直接复用宿主 primitives 的 `useAnchoredPosition` / `useDismissOnOutsidePointer`），缓存命中率改走插件共享的 `formatCacheHitPercent(…, 2)`（按两位小数取整，靠近 100% 时仍按"诚实尾数"多显示一位，如 `99.97`），弹窗各行与胶囊标签同步生效。数据面同样是 `sessionStats` / `tokenUsage` 两个投影（不做窗口折叠兜底）；根元素同样带 `data-composer-stats`。图标方面，胶囊的 gauge 图标在 0.1.3+ 的 primitives 里才存在，插件按 rc.1 类型编译，故运行时优先从宿主 primitives 取 `IconGaugeOutline16`，取不到则回退为时钟图标。与"经典统计行"的层叠关系：两项同写一个槽位格，经典统计行注册在 `priority: -2` 优先渲染，本项在其下被遮蔽（不渲染、零开销）；经典统计行关闭后本项若仍为开则自动接管格子，两者都关时恢复原生胶囊。该开关始终显示，不再随经典统计行隐藏：经典统计行同样读取它决定命中率的小数位数。

## 致谢

本插件的灵感来自并参考了 [wlj521/dsh-ui-tweaks](https://github.com/wlj521/dsh-ui-tweaks)——一个更全面的 DSH UI 个性化插件，覆盖字体、表格、时间线、Git 等更多维度。如果本插件的功能不够用，欢迎前往看看。

## 协议

MIT