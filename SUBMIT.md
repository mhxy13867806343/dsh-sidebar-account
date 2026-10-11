# 提交到 awesome-dsh-plugin 收录

在 `awesome-dsh-plugin` 仓库新建文件
`data/plugins/mhxy13867806343__dsh-sidebar-account.yml`：

```yaml
url: https://github.com/mhxy13867806343/dsh-sidebar-account
name: mhxy13867806343/dsh-sidebar-account
category: ui
description:
  en: 'Sidebar balance row for DSH Desktop — account balance and a top-up button, right under the version row; refreshes every 10 minutes and whenever the window regains focus, with explicit signed-out and error states.'
  zh: 'DSH Desktop 侧栏余额行——在「版本 / 检查更新」下面显示账户余额与「充值」按钮，每 10 分钟或窗口重新聚焦时刷新，未登录与读取失败都有明确状态。'
```
> 英文描述里有「冒号 + 空格」，**必须加引号**，否则 YAML 会当成嵌套键解析失败。

## 门槛

`MIN_AGE_DAYS = 1`（[check-submission.mjs](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/scripts/check-submission.mjs)），
仓库建于 `2026-10-09T09:16Z` → **已满足**。

| 项 | 状态 |
| --- | --- |
| `dsh.bundle` manifest | ✅ `{"patch":"./cordis.patch.yml"}` |
| `cordis.patch.yml` | ✅ 仓库根 |
| `dsh-plugin` topic | ✅ 已加 |
| 仓库年龄 ≥1 天 | ✅ |
| 本地跑官方校验 | 见提 PR 前那一步（`node scripts/check-submission.mjs --base origin/main`） |

## PR 标题/正文建议

标题：`Add mhxy13867806343/dsh-sidebar-account`

```markdown
## 提交插件
- repo: https://github.com/mhxy13867806343/dsh-sidebar-account
- 分类: ui
- 说明: DSH Desktop 侧栏余额行（余额 + 充值），挂在 sidebar.footer.action，
        与「版本 / 检查更新」那行同一套尺寸与对齐；未登录/读取失败都有明确状态。
```

## 备注

- 这个插件只读账号状态（`ctx.remote.account.getState()` / `getBalance()`），不发任何写请求；
- 「充值」走账号状态里给出的 `links.topUpUrl`，新窗口打开官网页面。
