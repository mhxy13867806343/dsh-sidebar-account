/**
 * 侧栏余额行的回归测试。
 * 这行坏过三次（挤成一团 / 充值变蓝字下划线 / 宽度失效），所以把「当初踩过的坑」
 * 逐条钉成断言：内联宽度、卡片两端对齐、充值必须是实心 primary、a.dsa-btn 兜底样式必须还在。
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.DSH_TEST_DEPS ?? new URL('../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const CLIENT_PATH = fileURLToPath(new URL('../client.js', import.meta.url));

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (d) => (captured = d) }, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.document = { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} };
await import(CLIENT_PATH);

const mod = captured.factory((id) => { if (id === 'react') return React; throw new Error(id); });
const reg = [];
mod.apply({ effect: (fn) => fn(), slots: { inject: (_k, cb) => cb(), register: (o, C) => reg.push({ o, C }) }, locale: { register: () => () => {}, getSnapshot: () => ({ active: 'zh' }) }, remote: { account: {} } });
const row = reg.find((e) => e.o.id === 'sidebar-account');
const t = (k) => ({ 'row.balance': '余额', 'row.topUp': '充值', 'row.loading': '读取中', 'row.unavailable': '暂不可用', 'row.signedOut': '未登录', 'row.title': '充值余额', 'row.railTitle': '前往充值' }[k] ?? k);

let fail = 0;
const check = (label, ok, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`); if (!ok) fail += 1; };

// ① 已登录
mod.__test.publish({ loaded: true, signedIn: true, amountText: '¥21.38', topUpUrl: 'https://platform.deepseek.com/top_up' });
const html = renderToStaticMarkup(React.createElement(row.C, { wide: true, t }));
const text = html.replace(/<style>[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' · ').replace(/(\s*·\s*)+/gu, ' | ').replace(/\s+/gu, ' ').trim();
check('顺序：余额在左、充值在右（和「版本/检查更新」那行对齐）', text.indexOf('余额') < text.indexOf('充值'), text);
check('最外层 wrap 有内联 width:100%（<style> 不生效也不会挤成一团）', /class="dsa-wrap"[^>]*style="[^"]*width:\s*100%/u.test(html) || /style="[^"]*width:\s*100%[^"]*"[^>]*class="dsa-wrap"/u.test(html));
check('卡片有内联两端对齐 + 边框（不依赖 <style>）', /dsa-card/u.test(html) && /justify-content:\s*space-between/u.test(html) && /border:\s*\.5px solid/u.test(html));
check('充值走实心 primary（描边款会露出宿主蓝字下划线）', html.includes('data-variant="primary"'));
check('a.dsa-btn 兜底样式还在（防止蓝字下划线复现）', html.includes('a.dsa-btn, a.dsa-btn:visited'));
check('金额正常显示', html.includes('¥21.38'));
check('充值是真链接（新窗口打开）', /target="_blank"/u.test(html) && /top_up/u.test(html));

// ② 未登录
mod.__test.publish({ loaded: true, signedIn: false, amountText: null, topUpUrl: null });
const out2 = renderToStaticMarkup(React.createElement(row.C, { wide: true, t }));
check('未登录：不显示金额、不崩', !out2.includes('¥') && out2.length > 0, out2.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 60));

// ③ 窄栏：只出图标，且自带 <style>
mod.__test.publish({ loaded: true, signedIn: true, amountText: '¥21.38', topUpUrl: 'https://x' });
const rail = renderToStaticMarkup(React.createElement(row.C, { wide: false, t }));
const railText = rail.replace(/<style>[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, '').trim();
// 窄栏只渲染 SVG 图标：剥掉标签后本来就没有文字，所以断言「没有文字 + 有 svg」
check('窄栏只出图标（不出现「余额」文字，但有 svg 图标）', !railText.includes('余额') && rail.includes('<svg'), JSON.stringify(railText.slice(0, 20)));
check('窄栏自带 <style>（折叠侧栏时不会退化成浏览器默认按钮）', rail.includes('<style>'));
console.log(fail === 0 ? '\n全部通过' : `\n${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
