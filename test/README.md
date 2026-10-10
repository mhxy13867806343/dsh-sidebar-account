# 余额行回归测试

```bash
cd <仓库根> && npm install     # react / react-dom 已在 devDependencies
node test/row-test.mjs
```

## ⚠️ 必须保留（都是真踩过的坑）

1. **最外层 `.dsa-wrap` 要有内联 `width:100%`** —— 这个宿主的 `<style>` 块出现过不生效，
   那时内层卡片写 `100%` 也只等于内容宽 → 整行挤成中间一团。
2. **卡片要有内联 `justify-content: space-between` + 边框** —— 同上，不依赖 `<style>`。
3. **`充值` 必须 `data-variant="primary"`（实心）** —— 改成描边款会让宿主对 `<a>` 的默认样式
   （蓝字 + 下划线）透出来，看着像坏了。
4. **`a.dsa-btn, a.dsa-btn:visited` 兜底规则不能删** —— 它显式压掉宿主给 `<a>` 的默认样式。
5. **窄栏（`wide === false`）分支要自带 `<style>`** —— 否则折叠侧栏且没展开过宽栏时，
   图标按钮会退化成浏览器默认外观。

改 `client.js` 后请重跑 `node test/row-test.mjs`。
