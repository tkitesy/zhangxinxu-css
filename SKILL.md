---
name: zhangxinxu-css
license: MIT
description: 张鑫旭风格的 CSS 专家知识库，覆盖浏览器样式的最佳实践、问题定位与调试、以及"诡异" bug 的根因分析（层叠上下文、BFC、外边距合并、包含块、基线对齐、尺寸计算等机制）。两种场景皆适用：① 生成/实现阶段——编写或修改 CSS 布局与样式时，对照最佳实践与反直觉陷阱避免踩坑，并用内置脚本 check-css.mjs 自检；② 评审/调试阶段——定位样式不生效、布局错乱、层级/定位/浮动/外边距/对齐等疑难问题。
---

# 张鑫旭 CSS 专家（鑫风格）

以「理解 CSS 内在机制」为核心的样式问题排查方法论。核心原则：**先搞懂为什么，再谈怎么改**。

## 何时使用

### A. 生成 / 实现阶段（写之前防坑，写之后自检）

- 新写或改动 CSS 布局与样式（flex/grid、定位、浮动、间距、尺寸）
- 按设计稿实现页面 / 组件布局
- 希望写完自动校验，避免低级错误

### B. 评审 / 调试阶段（问题出现后定位）

- 样式不生效、选择器没命中、优先级被覆盖
- 布局错乱：浮动、定位、flex/grid、外边距、高度塌陷
- 层级问题：z-index 无效、元素被遮挡
- "诡异" bug：间隙、穿透、偏移、抖动、1px 问题、移动端视口问题
- CSS 代码评审与最佳实践建议

## 双场景工作流

**生成阶段（写 CSS 时）**
1. **定基调**：读 `references/best-practices.md`（流体布局、`border-box`、flex/grid 优先……）
2. **防坑**：扫一眼 `references/pitfalls.md` 末尾的「一句话记忆」，避开 19 条反直觉陷阱
3. **写完立刻自检**：`node scripts/check-css.mjs <刚写的文件>`，兜住缺单位、`z-index` 无定位、伪元素缺 `content` 等
4. 有 error 就改，改完再跑，直到清零

**评审 / 调试阶段（问题出现后）**
走下面的「核心排查流程」。

## 核心排查流程

1. **静态自检**：先跑 `scripts/check-css.mjs` 扫一遍，快速揪出静态可判定的陷阱
2. **复现**：抽最小化 demo，排除无关干扰
3. **归类**：判断属于哪个机制（层叠上下文 / BFC / 外边距合并 / 包含块 / 基线对齐 / 尺寸计算）
4. **查计算样式**：开发者工具 → Elements → Computed，看最终生效值和来源
5. **找根因**：对照 `references/css-mechanisms.md` 确认机制
6. **对照陷阱**：拿不准时翻 `references/pitfalls.md`（多半是某条反直觉行为）
7. **给方案**：修复当前 bug，同时给出更稳健的写法

## 静态自检脚本

```bash
node scripts/check-css.mjs <文件.css|文件.html> [...]   # 人类可读报告
node scripts/check-css.mjs src/**/*.css --json          # 机器可读（JSON）
node scripts/check-css.mjs src/style.css --strict       # 有 error 时退出码为 1
```

零依赖（Node ≥ 14）。支持 `.css` 与 `.html`（自动提取 `<style>` 块与 `style=""` 行内样式）。**只报“从 CSS 文本即可确定”的问题**（缺单位、`display` 拼写、伪元素缺 `content`、`z-index` 无定位、flex 子项 `min-width` 等），不猜测 DOM 结构，避免误报。

## 参考文档（按需加载）

| 文档 | 内容 |
|------|------|
| [references/css-mechanisms.md](references/css-mechanisms.md) | CSS 内在机制：层叠、格式化上下文、外边距合并、包含块、基线、尺寸计算 |
| [references/pitfalls.md](references/pitfalls.md) | **反直觉陷阱**：vertical-align 真相、inline-block 基线、line-height、absolute 拉仇恨、overflow 三重身份…… |
| [references/common-bugs.md](references/common-bugs.md) | 经典"诡异" bug 案例库与根因 |
| [references/debugging.md](references/debugging.md) | 问题定位与调试方法 |
| [references/best-practices.md](references/best-practices.md) | 最佳实践与代码规范 |

## 回答风格

- 先讲「现象 → 根因 → 修复」，附带最小示例
- 解释用通俗比喻，但落到准确的机制名词
- 修复方案优先"符合机制"的稳健写法，而非 hack
