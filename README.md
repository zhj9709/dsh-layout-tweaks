# dsh-conversation-style-tweaks

> **版本要求**：需要 **DSH v0.1.2-rc.1 及以上**。

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)（DSH）Web UI 插件：为对话视图提供一套可选的 CSS 调整项——精确的列宽控制，以及一系列小幅度布局修复。

## 功能

### 布局（端口自 dsh-dialog-width）

- **插件宽度控制**（默认开启）：开启时插件自带的列宽输入 / 预设接管列宽，并隐藏 DSH 原生的拖拽手柄；关闭时原生手柄接管列宽，插件同步显示当前值。
- **对话框宽度**：600–1600 px 之间任意值；含 748（默认）/ 880（稍宽）/ 1024（更宽）三个预设按钮。
- **两侧边距**：对话区域两侧保留的空白（px），列宽被钳制为对话框宽度，侧边栏打开或窗口缩小时内容会收窄，不会贴住边缘。最低 32 px。

### 调整项

- **表格布局稳定（默认开启）**：锁住 markdown 表格 hover 时的布局，避免周围内容发生回流（"鼠标移到表格上时下方文本会跳动"）。

```yaml
conversation-style-tweaks:
  # 布局
  usePluginWidth: true   # 默认 true；false 时由原生拖拽手柄接管
  dialogWidth: 748       # 600–1600 px
  sideMargin: 50         # ≥ 32 px
  # 调整项
  stableTable: true      # 默认 true；false 则关闭
```

设置入口：**设置 → 对话样式**。

## 安装

```bash
# 方式一：从 npm 安装（推荐，预构建产物）
npx -y @deepseek-ai/dsh plugin --profile web add dsh-conversation-style-tweaks

# 方式二：从 GitHub 仓库安装（源码，会运行自包含的 prepare 构建）
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-conversation-style-tweaks
```

`add` 后面的包说明会**原样转发给 pnpm**，因此可以指定版本——npm 包用 `@版本号`，GitHub 源码用 `#tag`：

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-conversation-style-tweaks@0.0.1                    # 锁定 npm 版本
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-conversation-style-tweaks#v0.0.1     # 锁定 git tag
```

安装完成后**重启一次 `dsh web`**（bundle 插件在进程启动时扫描）。

## 开发

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

## 工作原理

- **服务端**（`src/index.ts`）：注册 `conversation-style-tweaks` 设置命名空间，并挂载同源路由 `/_dsh/conversation-style-tweaks/settings`。
- **浏览器端**（`src/client/index.tsx`）：读写该路由、渲染设置页，并根据每个开关的状态通过运行时 `<style>` 元素实时注入对应的 CSS。
- **列宽样式引擎**（`src/client/conversation-width.ts`）：写入 `--dsh-chat-user-width` CSS 变量，并在插件接管列宽时隐藏原生 `[data-width-handle]` 拖拽手柄；宽度值同时镜像到原生手柄读取的 localStorage 槽位，开关切换时无缝往返。
- **调整项注册表**（`src/client/tweaks/registry.ts`）：每个调整项的元数据（id、settings 字段名、默认值、i18n 键）集中登记；新增调整项只需在注册表里加一条，并在 `src/client/tweaks/` 下新增一个注入文件。

## 致谢

本插件的灵感来自并参考了 [wlj521/dsh-ui-tweaks](https://github.com/wlj521/dsh-ui-tweaks)——一个更全面的 DSH UI 个性化插件，覆盖字体、表格、时间线、Git 等更多维度。如果本插件的功能不够用，欢迎前往看看。

## 协议

MIT