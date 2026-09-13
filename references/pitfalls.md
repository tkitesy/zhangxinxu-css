# 反直觉陷阱

> 张鑫旭方法论的精华：**那些"你以为你懂、其实理解反了"的 CSS 行为。**
> 每节按「常见误解 → 真相/原理 → 修复」组织。凡是"诡异 bug"，多半撞在这里。

---

## 1. `vertical-align: middle` 不是"垂直居中"

**误解**：给元素设 `vertical-align: middle` 就能垂直居中。

**真相**：`middle` 是把元素的**中线**对齐到「父行盒基线 + x-height 的一半」的位置。参照物是 **x-height（小写 x 的高度）**，既不是行盒高度，也不是块高度。所以：
- 对**块级元素完全无效**（只作用于内联元素、inline-block、表格单元格）
- 即便对内联元素，结果也常常"看着没居中"，因为参照的是字母 x 的中线

```css
/* ❌ 这不是"垂直居中"，只是把中线对齐到 x-height 中线 */
.icon { vertical-align: middle; }

/* ✅ 真正居中：flex */
.row { display: flex; align-items: center; }
```

> 例外：表格单元格（`display: table-cell`）的 `vertical-align: middle` 是**真·垂直居中**。

---

## 2. `inline-block` 的基线，由它内部决定

**误解**：inline-block 的基线就是它的底边。

**真相**：`inline-block` 的基线 = **其内部最后一个行盒的基线**。
- 若里面有文字 → 基线是文字基线
- 若里面**没有行盒**（空元素，或 `overflow` 非 `visible`）→ 基线退化为**底边缘（margin 底）**

这解释了两个经典怪象：
1. 一排 inline-block 里，**空的那个会"掉下去"或位置和别的不齐**（基线规则不同）
2. 给 inline-block 加 `overflow: hidden` 后**位置突然变了**（基线从"内部文字基线"变成"底边"）

```css
/* 想要顶对齐，就别依赖基线 */
.item { display: inline-block; vertical-align: top; }
```

**孪生问题——inline-block 之间的空白间隙**：
源码里元素间的换行/空格会被渲染成匿名行内盒，撑出约 4px 空隙。
- 修复：父级 `font-size: 0`、删除源码空白，或改用 `flex`（推荐）

---

## 3. `line-height` 才是撑高行盒的主角

**误解**：元素高度由 `font-size` 决定，`line-height` 只是"行间距"。

**真相**：
- 块级元素的高度 = 其内部**每个行盒（line box）高度之和**
- 行盒高度主要由 `line-height` 决定
- 行内元素的内容区高度 = `font-size`（字体框），超出部分作为**半行距**上下均分
- 所以给一个 `<span>` 设大 `line-height`，会**把父元素撑高**

```css
/* 父元素会被撑高，即使 span 是"行内"的 */
p { }
p span { line-height: 60px; }
```

**继承的坑**：`line-height` 无单位 vs 带单位，继承行为不同：
```css
.a { line-height: 1.5; }   /* 继承"倍数"，子元素按自己的 font-size 重算 ✅ 推荐 */
.b { line-height: 24px; }  /* 继承"计算值 24px"，子元素 font-size 变了也是 24px */
```

---

## 4. `position: absolute` 的"拉仇恨"能力

**误解**：`absolute` 只是"脱离文档流 + 相对父级定位"。

**真相**：一个元素一旦 `absolute`，会**连带触发一长串变化**：

| 变化 | 说明 |
|------|------|
| `display` 计算值变 `block` | `inline` / `inline-block` 都被强制成 `block` |
| 宽度收缩为"自适应内容" | shrink-to-fit，不再撑满容器 |
| `float` 失效 | 浮动的行为被定位覆盖 |
| 包含块改变 | 参照最近的**非 static** 祖先（的 padding 盒） |
| 百分比参照改变 | `width/height` 的 % 相对新包含块 |
| 父容器不计其高 | 脱离文档流 → 可能高度塌陷 |
| 无偏移则停在原地 | 不写 `top/left`，它会停在原 static 位置 |
| 创建层叠上下文 | `z-index` 非 auto 时 |

```css
/* 以为只影响自己，其实 display 已被改成 block、宽度也收缩了 */
.badge { position: absolute; }  /* 想让它"还是 inline 的宽度"？没这回事 */
```

---

## 5. `overflow` 的三重身份

一个 `overflow: hidden` 同时是**三样东西**：

1. **裁剪器**——溢出内容被切掉（tooltip、下拉菜单、阴影会被误伤）
2. **滚动容器**——`overflow` 非 `visible` 的元素会成为 `position: sticky` 的滚动参照（常导致 sticky"失效"）
3. **BFC**——包裹浮动、阻隔外边距合并（很多人用它来清浮动）

```css
/* 只想清浮动，却把按钮的阴影/tooltip 裁了 */
.card { overflow: hidden; }        /* ❌ 副作用多 */
.card { display: flow-root; }      /* ✅ 只创建 BFC，不裁剪 */
```

**反直觉**：`overflow: hidden` 的元素**仍然可以被 JS 滚动**（`scrollTop`/`scrollIntoView`），只是不显示滚动条。

---

## 6. 外边距合并的完整形态（不止"兄弟取大值"）

| 形态 | 触发 | 表现 |
|------|------|------|
| 兄弟合并 | 相邻块级元素的垂直 margin | 取较大值 |
| **父子穿透** | 子 `margin-top` + 父无 border/padding/内联内容/BFC | 子把父一起顶下去 |
| **空元素自合并** | 元素无内容、无高度、无 padding/border | 自身 `margin-top` 与 `margin-bottom` 合并 |
| 负 margin | 一正一负 | 相加 |

**容易忽略的边界**：
- **只有垂直方向**会合并，水平永不合并
- `float`、`position: absolute`、`flex/grid` 子项、`inline-block`（与父之间）**不合并**
- 父元素 `height: auto` 时，子元素的 `margin-bottom` 可能**"漏"到父元素外面**

```css
/* 父子穿透的 3 种解法 */
.parent { display: flow-root; }      /* 建 BFC */
.parent { padding-top: 1px; }         /* 加阻隔 */
.parent { border-top: 1px solid transparent; }
```

---

## 7. 百分比 `padding` / `margin` 的上下，也按**宽度**算

**误解**：`padding-top: 50%` 是按父元素高度的 50%。

**真相**：CSS 规定，百分比 `padding` 和 `margin`（**包括上下**）都相对包含块的**宽度**（inline-size）计算。

```css
/* 反直觉但有用的"等比占位"技巧（旧时代做 16:9） */
.thumb { position: relative; padding-top: 56.25%; }  /* 56.25% = 9/16，按宽度算 */
.thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

/* 现在直接用 */
.thumb { aspect-ratio: 16 / 9; }
```

---

## 8. `height: 100%` 的链式依赖

**真相**：百分比高度要求父级有**明确高度**；`height: auto` 不算"明确"，此时百分比高度按 `auto` 处理（失效）。

**反直觉**：所以想让深层元素 `height: 100%`，往往得从根上把整条链都设高度：

```css
html, body { height: 100%; }   /* 缺一环，下面全失效 */
.app { height: 100%; }
.panel { height: 100%; }
```

**更稳的做法**：用 `flex` / `grid` 让子元素自动拉伸，或用 `min-height` + `100dvh`：
```css
.app { min-height: 100dvh; display: flex; flex-direction: column; }
```

---

## 9. `background-position` 百分比 ≠ "从左边偏移百分之几"

**误解**：`background-position: 25% 25%` 是"距左上角各 25%"。

**真相**：百分比定位是把「**图片自身的对应百分比点**」对齐「**容器的对应百分比点**」：
```
偏移 = (容器尺寸 - 图片尺寸) × 百分比
```
- `0% 0%` = 左上，`100% 100%` = 右下，`50% 50%` = 居中
- `25% 25%` 表示"图片 25% 处对齐容器 25% 处"，**不是**"距左边 25%"

**需要"固定边距"** → 用像素或 `calc()`：
```css
.bg { background-position: calc(100% - 20px) center; }
```

---

## 10. `transform` / `filter` / `will-change` 会创建**包含块**和**层叠上下文**

**现象**：给某祖先加了 `transform` 后，里面的 `position: fixed` 元素**不再相对视口**，而是跟着这个祖先跑。

**真相**：当元素 `transform` / `filter` / `perspective` / `will-change`（指定这些）非 none 时：
1. 它成为后代 `fixed` / `absolute` 的**包含块**
2. 它**创建层叠上下文**（影响 `z-index` 的比较范围）

```css
/* 祖先一旦有 transform，fixed 就"失效"了 */
.wrapper { transform: translateZ(0); }  /* 可能是某处为开启 GPU 加的 */
.modal { position: fixed; }             /* ← 会相对 .wrapper 定位，而非视口 */
```
**修复**：把 `fixed` 元素移出该祖先，或避免在祖先上用 transform。

---

## 11. `opacity < 1` 也会创建层叠上下文

**现象**：父元素只加了 `opacity: 0.99`，子元素 `z-index` 再大也压不过别人。

**真相**：`opacity` 小于 1 即创建**层叠上下文**，子元素的 `z-index` 被"锁"在这个结界里比较。
同类"隐形结界制造者"：`transform`、`filter`、`isolation: isolate`、`backdrop-filter`、`mix-blend-mode`、`contain: paint`。

**修复**：不要用 `opacity: 0.99` 之类做"几乎不透明"；明确层级时显式用 `isolation: isolate` 划分作用域。

---

## 12. flex / grid 子项的 `min-width: auto`

**现象**：flex 子项内容不换行、溢出容器，给它设 `width: 30px` 也没用。

**真相**：flex 子项的 `min-width` 默认是 **`auto`**（= 内容的最小尺寸），所以它**不肯被压缩到比内容更窄**。grid 子项同理（`min-width: auto`）。

```css
.flex { display: flex; }
.flex .item { min-width: 0; }        /* ✅ 允许收缩，overflow: hidden 也可 */
```

---

## 13. `width: auto` 与 `width: 100%` 不是一回事

```css
.a { width: auto; }   /* 会考虑自身 margin/border/padding；配合 margin:auto 可居中 */
.b { width: 100%; }   /* = 包含块 content 宽，不含自身 border/padding，可能溢出 */
```
在 `content-box` 下，`.b` 若有 padding/border 就会**超出容器**（`100% + padding + border`）。这正是 `box-sizing: border-box` 被广泛推崇的原因之一。

---

## 14. 选择器权重的两个反直觉点

```css
:where(.a, #b) { color: red; }   /* 权重 = 0,0,0（:where 归零！） */
:is(.a, #b)    { color: red; }   /* 权重 = 参数中最高者 → id 级 */
:not(#x)       { color: red; }   /* :not/:is/:has 都取参数最高权重 */
```
- `:where()` 权重**恒为 0** —— 做低权重"默认样式"、便于覆盖的利器
- `:is()` / `:not()` / `:has()` 的权重 = **括号内参数里最高的那个**

---

## 15. `display` 三兄弟：`none` / `visibility: hidden` / `opacity: 0`

| | 占位 | 可点击 | 可被读屏 | 可过渡 |
|--|------|--------|----------|--------|
| `display: none` | 否 | 否 | 否 | 否 |
| `visibility: hidden` | **是** | 否 | 否 | 部分（visibility 可 transition） |
| `opacity: 0` | **是** | **是** | **是** | 是 |

反直觉：`opacity: 0` 的元素**仍然接收点击、能被 Tab 聚焦**（无障碍陷阱）；`display:none` 无法参与过渡动画。

---

## 16. `float` 会把元素"变成块级"

**真相**：`float` 非 none 时，元素的 `display` **计算值**会被改为 `block`（`inline` → `block`，`inline-block` 保持块状）。所以你给一个 `<span>` 加 `float: left`，它就能设宽高了——不是因为它"变成"了块级，而是**计算值被调整了**。

同理，`position: absolute/fixed` 也会做同样的 display 计算值调整（见 §4）。

---

## 17. `position: sticky` 生效的三个前提

`sticky` 常"没反应"，几乎总是这三个之一：

1. **必须有阈值**：至少写 `top` / `right` / `bottom` / `left` 之一
2. **必须有滚动祖先**：最近的滚动容器要是预期的那一层——若中间有 `overflow: hidden/auto/scroll` 的祖先，就会**改变滚动参照**，导致 sticky 不动
3. **父级要有可滚动空间**：父元素高度若和内容一样高，元素没有"滑动余量"

```css
/* 常见元凶：某祖先设了 overflow，砍断了 sticky */
.list { overflow: hidden; }   /* ← 就是它 */
```

---

## 18. `vertical-align` 的百分比，是相对 `line-height` 的

`vertical-align: 50%` 不是"相对行高居中"，而是把元素的基线**相对于父元素基线**上移 `50% × line-height`。和 §1 一样，别拿它当居中工具。

---

## 附：一句话记忆

- `vertical-align` 的参照物是 **x-height 中线**，不是容器高度
- `inline-block` 的基线看**内部**，空的会"掉底"
- 撑高行盒的是 `line-height`，不是 `font-size`
- `absolute` 是"拉仇恨"，会改 display / 宽度 / 包含块 / 浮动
- `overflow: hidden` = 裁剪 + 滚动容器 + BFC，三位一体
- 百分比 `padding/margin` 上下也按**宽度**算
- `transform` / `opacity` 是"隐形结界"，会造包含块和层叠上下文
- flex 子项默认 `min-width: auto`，不写 `0` 就别想压缩
