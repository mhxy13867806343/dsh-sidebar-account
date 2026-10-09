/**
 * dsh-sidebar-account — Host 半边。
 *
 * 空壳：余额与充值完全在客户端完成 —— 宿主已经把账号能力生成为 `ctx.remote.account`，
 * 客户端插件直接读它即可（`getState()` 里带充值链接，`getBalance()` 里带余额）。
 * 这里不需要注册任何 Host 服务、路由或定时器。
 */
export function apply() {}
