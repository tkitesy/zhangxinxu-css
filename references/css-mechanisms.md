# CSS 内在机制

> 排查样式的根基。凡"诡异"问题，几乎都能归结为以下机制之一。

## 1. 层叠与优先级（为什么我的样式没生效）

### 优先级（specificity）
按 `(id, class, type)` 三元组比较：
- `#id` → (1,0,0)
- `.class` / `[attr]` / `:hover` → (0,1,0)
- `div` / `::before` → (0,0,1)

比较规则：从左到右逐位比较，高位大者胜；都相同则看源码顺序（后者胜）。

层级从低到高：
1. 浏览器默认样式（user agent）
2. 用户普通声明
3. 作者普通声明
4. 作者 `!important`
5. 用户 `!important`

### 继承
- **可继承**：`color`、`font-*`、`line-height`、`text-*`、`visibility`、`cursor`、`list-style` 等
- **不可继承**：盒模型（`width/height/margin/padding/border`）、`position`、`background`、`display` 等

关键字：`inherit` / `initial` / `unset` / `revert`。

> 排查"为什么子元素也有这个样式"时，先看是不是继承；排查"为什么没继承"时，看属性本身是否可继承。

### 层叠上下文（stacking context）—— z-index 的"结界"
`z-index` 只在**同一层叠上下文**内比较。触发层叠上下文的常见条件：

- 根元素 `<html>`
- `position: relative/absolute` 且 `z-index` ≠ `auto`
- `position: fixed` / `sticky`
- flex/grid 子项且 `z-index` ≠ `auto`
- `opacity` < 1
- `transform` / `filter` / `backdrop-filter` / `perspective` 非 none
- `clip-path` / `mask` / `mask-image` 非 none
- `contain: layout/paint/strict/content`
- `will-change` 指定上述任一属性
- `isolation: isolate`、`mix-blend-mode` 非 normal

> **关键结论**：子元素的 z-index 再大，也翻不出父级层叠上下文的"天"。若父级被某个祖先层叠上下文压住，子元素 z-index 无效。

## 2. 格式化上下文（BFC / IFC）

### BFC（块级格式化上下文）
触发条件：根元素、`float` 非 none、`position: absolute/fixed`、`overflow` 非 `visible`、`display: inline-block/table-cell/flex/grid/flow-root`、`contain: layout/paint/content/strict`。

BFC 的三条"特异功能"：
1. **包裹浮动**：内部浮动元素被计入高度 → 解决父容器高度塌陷
2. **阻隔外边距**：与外部不合并 → 解决 margin 穿透
3. **不与浮动重叠**：用于两栏自适应布局

### IFC（内联格式化上下文）
- 行内元素在**行盒（line box）**中排列
- `vertical-align`、`line-height` 都基于行盒与基线
- 空白字符会生成匿名行内盒 → inline-block 之间间隙的根源

## 3. 外边距合并（margin collapsing）

发生条件（三者同时满足）：
1. 垂直方向（上下 margin）
2. 相邻（兄弟之间、父子之间、空元素自身）
3. 之间没有 border / padding / 行内内容 / clearance / BFC 隔离

规则：合并后取**较大值**；一正一负则相加；都负取绝对值大者。

**父子穿透**：子元素 `margin-top` 会"顶"到父元素上，把父元素一起顶下来。

解决手段（任选其一）：
- 父元素触发 BFC（`overflow: hidden`、`display: flow-root` 等）
- 父元素加 `padding-top` / `border-top`
- 父元素加行内内容
- 用 flex / grid 容器（其子项 margin 不合并）

## 4. 包含块（containing block）—— 定位的参照系

| 定位方式 | 包含块 |
|---------|--------|
| `static` / `relative` | 最近的块级祖先的 **content 区域** |
| `absolute` | 最近的 **非 static 祖先** 的 padding 区域 |
| `fixed` | **视口**；但若祖先有 `transform/filter/will-change` 等，则变成该祖先 |
| `sticky` | 最近的**滚动祖先**（scroll container） |

> `position: absolute` 的相对偏移（top/left）参照的是包含块，**不是**最近的 relative 元素的"边框"，而是它的 **padding 盒**。

## 5. 基线对齐（vertical-align）

- `vertical-align` 只对**内联元素、inline-block、表格单元格**生效，对块级元素无效
- 默认 `baseline`：元素的基线对齐父行盒的基线
- 图片、inline-block 默认按基线对齐 → 下方留出 descender 空隙（经典"图片底部 3px 空隙"）

## 6. 尺寸计算

### width 的约束方程
`margin-left + border-left + padding-left + width + padding-right + border-right + margin-right = 包含块 content 宽度`

- `width: auto` + `margin: auto` → 平分剩余空间（居中）
- 若约束不满足，浏览器按规则"过度约束"调整，通常 `margin-right` 被强制为 auto 吸收差值

### 优先级
`min-width` / `max-width` **优先于** `width`。

### box-sizing
- `content-box`（默认）：`width` 只算 content
- `border-box`：`width` 含 padding + border，更符合直觉

### 百分比
- 百分比 `width` 相对包含块 content 宽度
- 百分比 `height` 相对包含块高度，**但要求父级有明确高度**，否则失效

## 7. 定位行为速查

| 定位 | 是否脱离文档流 | 参照 | 备注 |
|------|--------------|------|------|
| `static` | 否 | — | 默认 |
| `relative` | 否 | 自身原位置 | 占位不变，视觉偏移 |
| `absolute` | 是 | 包含块 | 不占位 |
| `fixed` | 是 | 视口（或 transform 祖先） | 不占位 |
| `sticky` | 否 | 滚动容器 | 阈值内 relative，越界后固定 |

## 8. 渲染与性能（重绘 / 重排 / 合成）

- **重排（reflow）**：几何/布局变化（width、height、top、left、display、font、盒模型……）→ 代价最高
- **重绘（repaint）**：仅视觉变化（color、background、visibility、box-shadow……）→ 代价次之
- **合成（compositing）**：`transform`、`opacity` 走 GPU 合成层，不触发布局 → 代价最低

优化要点：
- 动画优先 `transform` / `opacity`，避免 `top/left/width`
- 批量修改样式、避免在循环中读写布局属性（强制同步布局）
- 慎用 `will-change`（预留合成层有内存代价）
