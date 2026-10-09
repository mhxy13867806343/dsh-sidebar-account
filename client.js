/**
 * dsh-sidebar-account — Client 半边。
 *
 * 在侧栏底部（`sidebar.footer.action`，也就是账号「token 患者」那一行的**上面**）
 * 加一行：左边「余额 ¥1.96」，右边一个「充值」按钮 —— 点它直接打开充值页。
 *
 * 数据全部来自宿主已经生成好的 `ctx.remote.account`：
 *   · `getState()`   → { status, links: { usageUrl, topUpUrl } }，「充值」按钮用的就是这个 topUpUrl；
 *   · `getBalance()` → { status: 'ready', value: [{currency, balance}], bonusWallets: [...] }
 * 不 import 任何 Harness 客户端包，样式只用宿主主题变量。
 *
 * 余额的刷新时机：挂载时、窗口重新获得焦点时（30 秒节流）、以及每 10 分钟一次。
 * 「充值」用和设置页同一个写法（`<a target="_blank">`）—— Desktop 主窗口的
 * window-open 处理器会把 http/https 链接交给系统浏览器打开。
 */

window.__ModuleLoader__.load({
	id: 'dsh-sidebar-account',
	factory: (require) => {
		const React = require('react');
		const h = React.createElement;

		/** 文案命名空间。 */
		const NS = 'sidebar-account';
		/** 定时刷新间隔。 */
		const REFRESH_MS = 10 * 60 * 1000;
		/** 焦点/可见性触发的刷新节流，免得来回切窗口就狂查。 */
		const THROTTLE_MS = 30 * 1000;
		/** 账号接口要求的客户端标识版本号（与设置页保持一致）。 */
		const CLIENT_VERSION = '0.2.0-rc.1';

		const zh = {
			'row.balance': '余额',
			'row.signedOut': '未登录',
			'row.loading': '读取中',
			'row.unavailable': '暂不可用',
			'row.topUp': '充值',
			'row.title': '充值余额',
			'row.railTitle': '前往充值',
		};
		const en = {
			'row.balance': 'Balance',
			'row.signedOut': 'Signed out',
			'row.loading': 'Loading',
			'row.unavailable': 'Unavailable',
			'row.topUp': 'Top up',
			'row.title': 'Topped-up balance',
			'row.railTitle': 'Top up',
		};

		/** 与更新行同一套观感（圆角卡片 + 右侧按钮），类名前缀换成 dsa- 免得和别家撞。 */
		const CSS = `
.dsa-wrap { width: 100%; }
.dsa-card {
  box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; min-width: 0; margin: 0 2px 6px; padding: 6px 8px;
  border: .5px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-size: 12px; line-height: 16px;
}
.dsa-main { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
.dsa-glyph { flex: none; display: inline-flex; color: var(--dsw-alias-label-secondary); }
.dsa-label { color: var(--dsw-alias-label-secondary); white-space: nowrap; flex: none; }
.dsa-amount {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}
.dsa-amount[data-state="muted"] { color: var(--dsw-alias-label-secondary); }
.dsa-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  height: 22px; padding: 0 8px; border-radius: var(--dsw-radius-sm, 6px);
  border: .5px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer;
  white-space: nowrap; text-decoration: none; box-sizing: border-box;
}
.dsa-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
/* 这是一个按钮，不是链接：显式压掉宿主对 <a> 的默认样式（否则会出现蓝字下划线） */
a.dsa-btn, a.dsa-btn:visited { color: var(--dsw-alias-label-primary); text-decoration: none; }
.dsa-btn[data-variant="primary"] {
  border-color: transparent; background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-inverted, #fff); font-weight: 500;
}
.dsa-btn[data-variant="primary"]:hover { filter: brightness(1.08); }
.dsa-btn[aria-disabled="true"] { opacity: .55; cursor: default; }
.dsa-btn[aria-disabled="true"]:hover { background: transparent; filter: none; }
.dsa-btn:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 1px; }
.dsa-rail {
  display: inline-flex; align-items: center; justify-content: center; gap: 2px;
  min-width: 32px; height: 32px; padding: 0 6px; border: none; border-radius: var(--dsw-radius-md, 8px);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  font: inherit; font-size: 12px; text-decoration: none;
}
.dsa-rail:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
`;

		// -------------------------------------------------------------------
		// 状态
		// -------------------------------------------------------------------

		let clientCtx = null;
		let listeners = new Set();
		let snapshot = {
			loaded: false,
			signedIn: false,
			amountText: null,
			hint: '',
			topUpUrl: null,
			failed: false,
		};
		let refreshing = false;
		let lastRefresh = 0;

		function publish(next) {
			snapshot = { ...snapshot, ...next };
			for (const listener of listeners) {
				try {
					listener();
				} catch {}
			}
		}

		function subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}

		function getSnapshot() {
			return snapshot;
		}

		// -------------------------------------------------------------------
		// 金额格式化（纯字符串截断，不走浮点，和设置页的「向下取两位」一致）
		// -------------------------------------------------------------------

		function formatMoney(amount, symbol) {
			const text = String(amount ?? '').trim();
			const match = /^(-)?(\d+)(?:\.(\d+))?$/u.exec(text);
			if (match === null) return `${symbol}${text}`;
			const negative = match[1] === '-';
			const integer = match[2];
			const fraction = match[3] ?? '';
			// 是不是真正的 0，要看**所有**小数位，不能只看前两位（0.005 不是 0）。
			if (/^0*$/u.test(integer) && /^0*$/u.test(fraction)) return `${symbol}0.00`;
			const cents = `${fraction}00`.slice(0, 2);
			const underOneCent = /^0*$/u.test(integer) && cents === '00';
			if (underOneCent) return negative ? `-${symbol}0.01` : `<${symbol}0.01`;
			const grouped = Number(integer).toLocaleString('en-US');
			return `${negative ? '-' : ''}${symbol}${grouped}.${cents}`;
		}

		function positive(value) {
			return /[1-9]/u.test(String(value ?? ''));
		}

		function walletText(wallet) {
			return formatMoney(wallet?.balance, wallet?.currency === 'CNY' ? '¥' : '$');
		}

		/** 把 getBalance 的结果折成「显示什么、悬停显示什么」。 */
		function describe(balance) {
			if (balance === null || balance === undefined) return { amountText: null, hint: '', failed: false };
			if (balance.status !== 'ready') return { amountText: null, hint: '', failed: true };
			const wallets = Array.isArray(balance.value) ? balance.value : [];
			const bonus = (Array.isArray(balance.bonusWallets) ? balance.bonusWallets : []).filter((wallet) => positive(wallet?.balance));
			const shown = wallets.length > 0 ? wallets : bonus;
			const hint = [
				wallets.length > 0 ? `充值余额 ${wallets.map(walletText).join(' + ')}` : '',
				bonus.length > 0 ? `赠金余额 ${bonus.map(walletText).join(' + ')}` : '',
			]
				.filter((part) => part !== '')
				.join(' · ');
			// 钱包为空也说明「读到了，就是 0」，不要一直显示读取中。
			const amountText = shown.length > 0 ? shown.map(walletText).join(' + ') : formatMoney('0', '¥');
			return { amountText, hint, failed: false };
		}

		// -------------------------------------------------------------------
		// 读取余额
		// -------------------------------------------------------------------

		async function refresh(force) {
			if (clientCtx === null || refreshing) return;
			const now = Date.now();
			if (force !== true && now - lastRefresh < THROTTLE_MS) return;
			refreshing = true;
			lastRefresh = now;
			try {
				const account = clientCtx.remote.account;
				const stateResult = await account.getState();
				const view = stateResult !== null && stateResult !== undefined && stateResult.ok ? stateResult.value : undefined;
				const signedIn = view?.status === 'credential-stored';
				const topUpUrl = typeof view?.links?.topUpUrl === 'string' && view.links.topUpUrl !== '' ? view.links.topUpUrl : null;
				let balance;
				if (signedIn) {
					const metadata = {
						version: CLIENT_VERSION,
						locale: clientCtx.locale.getSnapshot().active,
						timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
					};
					const result = await account.getBalance(metadata);
					balance = result !== null && result !== undefined && result.ok ? result.value : undefined;
				}
				publish({ loaded: true, signedIn, topUpUrl, ...describe(balance) });
			} catch {
				publish({ loaded: true, failed: true });
			} finally {
				refreshing = false;
			}
		}

		function useStatus() {
			return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
		}

		// -------------------------------------------------------------------
		// 视图
		// -------------------------------------------------------------------

		function WalletGlyph({ size = 14 }) {
			return h(
				'svg',
				{ width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, className: 'dsa-glyph' },
				h('rect', { x: 2, y: 4, width: 12, height: 9, rx: 2, stroke: 'currentColor', strokeWidth: 1.2 }),
				h('path', { d: 'M2 7h12', stroke: 'currentColor', strokeWidth: 1.2 }),
				h('circle', { cx: 11, cy: 10, r: 1.1, fill: 'currentColor' }),
			);
		}

		/** 侧栏底部那一行：余额 + 充值。 */
		function SidebarAccountRow({ wide, t }) {
			const state = useStatus();
			if (state.loaded !== true) return null;

			const disabled = typeof state.topUpUrl !== 'string' || state.topUpUrl === '';
			const amount = state.amountText ?? (state.failed ? t('row.unavailable') : t('row.loading'));
			const label = state.signedIn ? t('row.balance') : t('row.signedOut');
			const title = state.hint !== '' ? state.hint : t('row.title');
			const link = h(
				'a',
				{
					className: 'dsa-btn',
					'data-variant': disabled ? 'default' : 'primary',
					href: disabled ? undefined : state.topUpUrl,
					target: '_blank',
					rel: 'noreferrer',
					'aria-disabled': disabled ? 'true' : undefined,
					onClick: (event) => {
						if (disabled) event.preventDefault();
					},
				},
				t('row.topUp'),
			);

			if (wide === false) {
				return h(
					'a',
					{
						className: 'dsa-rail',
						href: disabled ? undefined : state.topUpUrl,
						target: '_blank',
						rel: 'noreferrer',
						title: `${t('row.railTitle')}${state.amountText === null ? '' : ` · ${state.amountText}`}`,
						onClick: (event) => {
							if (disabled) event.preventDefault();
						},
					},
					h('style', null, CSS),
					h(WalletGlyph, { size: 16 }),
				);
			}

			return h(
				'div',
				{ className: 'dsa-wrap' },
				h('style', null, CSS),
				h(
					'div',
					{ className: 'dsa-card', title },
					// 和上面那行（版本 + 检查更新）对齐：左边余额，右边充值。
					h(
						'span',
						{ className: 'dsa-main' },
						h(WalletGlyph, {}),
						h('span', { className: 'dsa-label' }, label),
						// 未登录时不摆「读取中」，只留「未登录」+ 充值。
						state.signedIn ? h('span', { className: 'dsa-amount', 'data-state': state.amountText === null ? 'muted' : 'ready' }, amount) : null,
					),
					link,
				),
			);
		}

		/**
		 * Client 插件体。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
			clientCtx = ctx;
			ctx.effect(
				() =>
					ctx.locale.register(NS, {
						zh,
						en,
					}),
				'dsh-sidebar-account: 文案',
			);
			// order 110 > 更新行的 100，也就是排在更新行**下面**、账号行上面。
			ctx.slots.inject('sidebar.footer.action', () =>
				ctx.slots.register(
					{
						name: 'sidebar.footer.action',
						id: 'sidebar-account',
						order: 110,
						locale: NS,
					},
					SidebarAccountRow,
				),
			);
			ctx.effect(() => {
				void refresh(true);
				const timer = setInterval(() => void refresh(true), REFRESH_MS);
				const onVisible = () => {
					if (document.visibilityState === 'visible') void refresh(false);
				};
				const onFocus = () => void refresh(false);
				document.addEventListener('visibilitychange', onVisible);
				window.addEventListener('focus', onFocus);
				return () => {
					clearInterval(timer);
					document.removeEventListener('visibilitychange', onVisible);
					window.removeEventListener('focus', onFocus);
				};
			}, 'dsh-sidebar-account: 余额刷新');
		}

		/** 需要的客户端服务：slot 注册表、文案、账号远端命名空间。 */
		const inject = ['slots', 'locale', 'remote', 'remote.account'];

		// 仅给 node --test 用（宿主与页面都不消费）。
		const __test = { getSnapshot, publish, subscribe, formatMoney, describe };

		return { apply, inject, __test };
	},
});
