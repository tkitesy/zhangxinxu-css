# 经典"诡异" bug 案例库

> 每个案例按「现象 → 根因 → 修复」组织。修复优先给"符合机制"的稳健写法。

## 1. z-index 设了却无效

- **现象**：元素 `z-index: 9999` 仍被压在下面。
- **根因**：`z-index` 只在同一层叠上下文内比较。要么该元素未创建层叠上下文（z-index 对 static 元素无效），要么父级/祖先的层叠上下文层级更低，被子元素"拖累"。
- **修复**：给该元素加 `position: relative/absolute`；检查父级是否触发层叠上下文并被更上层压住，必要时提升父级层级或调整结构。

## 2. 子元素 margin-top 把父元素顶下来（穿透）

- **现象**：给子元素加 `margin-top`，父元素也跟着往下移动。
- **根因**：父子垂直外边距合并。
- **修复**：父元素触发 BFC（`overflow: hidden` / `display: flow-root`），或加 `padding-top: 1px` / `border-top: 1px`，或改用 flex 容器。

## 3. 浮动导致父容器高度塌陷

- **现象**：子元素 `float: left` 后，父容器高度为 0，背景/边框"消失"。
- **根因**：浮动元素脱离正常流，父容器（未触发 BFC）不计算其高度。
- **修复**：父容器 `display: flow-root` 或 `overflow: hidden/auto` 触发 BFC；或使用 `clearfix`；或改用 flex/grid。

## 4. inline-block 元素之间的 4px 间隙

- **现象**：两个 `display: inline-block` 的元素之间莫名多出约 4px 空隙。
- **根因**：HTML 中的换行/空白字符被渲染成匿名行内盒，占据空间。
- **修复**：父级 `font-size: 0`（子级再设回字号）；删除源码空白；或改用 flex 布局。

## 5. 图片底部 3~5px 空隙

- **现象**：图片下方与容器底部之间有一小条空隙，容器比图片高。
- **根因**：图片是行内元素，默认 `vertical-align: baseline`，基线下方为 descender 预留空间。
- **修复**：`img { display: block }` 或 `img { vertical-align: top/middle/bottom }`，或父级 `line-height: 0` / `font-size: 0`。

## 6. absolute 定位参照"不对"

- **现象**：`position: absolute; top: 0` 没有相对预期的父元素定位。
- **根因**：包含块是最近的**非 static** 祖先；若所有祖先都是 static，则相对根元素/视口定位。
- **修复**：给预期参照的父元素加 `position: relative`；注意偏移参照的是其 **padding 盒**，不是边框。

## 7. 百分比 height 无效

- **现象**：子元素 `height: 50%` 不生效，高度为 0 或 content 高度。
- **根因**：百分比高度要求父级有**明确高度**；父级 `height: auto` 时无参照。
- **修复**：给父级设明确高度；或用 `flex`/`grid` 布局让子元素拉伸；或改用 `vh`、`aspect-ratio` 等。

## 8. overflow: hidden 意外"裁掉"内容

- **现象**：为清除浮动加了 `overflow: hidden`，结果把超出部分（tooltip、下拉菜单、阴影）裁掉了。
- **根因**：`overflow: hidden` 会裁剪溢出内容，还会创建滚动容器与 BFC。
- **修复**：改用 `display: flow-root` 清除浮动（不裁剪）；或把需要溢出的元素移出该容器。

## 9. fixed 定位被 transform 祖先"坑"

- **现象**：`position: fixed` 元素不再相对视口，而是跟着某个祖先滚动/偏移。
- **根因**：祖先元素有 `transform` / `filter` / `will-change: transform` 等，成为 fixed 的包含块。
- **修复**：把 fixed 元素移出该 transform 祖先；或去掉祖先的 transform；或改用 absolute + JS。

## 10. position: sticky 不吸顶

- **现象**：`position: sticky; top: 0` 不生效。
- **根因**：常见原因——父级/祖先设置了 `overflow: hidden/auto/scroll`（滚动容器不是预期的那层）；或父级高度与内容相等（没有滚动空间）；或未设 `top`。
- **修复**：移除祖先的 overflow 限制；确保父级有足够的可滚动高度；确认 top 值。

## 11. 移动端 100vh 被地址栏遮挡

- **现象**：`height: 100vh` 在移动端浏览器出现内容被地址栏遮挡或留白。
- **根因**：`100vh` 是视口高度，移动端地址栏收展导致实际可视区域变化。
- **修复**：用 `100dvh`（动态视口高度，现代浏览器）配合 `100vh` 回退；或改用 `min-height: 100%` + 布局方案。

## 12. 高分屏 1px 边框发虚/过粗

- **现象**：Retina 屏上 `border: 1px` 显得过粗或发虚。
- **根因**：CSS 1px 在 devicePixelRatio 2/3 屏上对应多个物理像素。
- **修复**：用 `transform: scale(0.5)` 伪元素方案；或 `border: 0.5px`（部分浏览器）；或接受 1px 视觉差异；或用 `box-shadow` / 渐变模拟。

## 13. 伪元素内容不显示

- **现象**：`::before` / `::after` 写了一大堆样式，屏幕上啥也没有。
- **根因**：缺少 `content` 属性——没有 `content`（哪怕是空字符串），伪元素不会被生成。
- **修复**：补上 `content: ""`（或具体内容）。

## 14. 文本与图标/图片垂直不对齐

- **现象**：图标和旁边文字对不齐，忽高忽低。
- **根因**：内联元素默认按基线对齐，图标（inline-block）基线受自身内容/高度影响。
- **修复**：统一 `vertical-align: middle`（注意 middle 是相对 x-height 中线）；或图标 `display: block` + flex 对齐；或统一 `line-height`。

## 15. 滚动条出现导致页面横向抖动

- **现象**：页面内容高度变化时，滚动条出现/消失导致内容左右抖动。
- **根因**：滚动条占据视口宽度，压缩了内容区。
- **修复**：`scrollbar-gutter: stable`；或 `overflow-y: scroll` 常驻滚动条；或 `width: calc(100% - 滚动条宽)`。

## 16. flex 子项被压缩/内容溢出

- **现象**：flex 子项内容溢出、被压扁，`width` 设了不生效。
- **根因**：flex 子项 `min-width` 默认为 `auto`，等于内容最小宽度；而 `flex-shrink` 默认允许收缩。
- **修复**：`min-width: 0`（允许收缩到 0）；或 `flex-shrink: 0`（禁止收缩）；或 `overflow: hidden`。

## 17. :hover 在移动端"粘住"

- **现象**：移动端点一次后 hover 样式一直保留。
- **根因**：触屏设备把第一次点击当作 hover。
- **修复**：把 hover 样式放到 `@media (hover: hover)` 内，或用 JS 管理 active/focus。

## 18. 背景图不显示

- **现象**：`background-image` 设了，看不到图。
- **根因**：常见——路径错误、容器无尺寸（宽高为 0）、`background-repeat` 未设而容器比图小、URL 引号/编码问题。
- **修复**：核对路径与文件名；给容器设尺寸或用 `background-size`；检查 network 面板确认请求是否发出。
