# 最佳实践

> 张鑫旭倡导的"符合机制、稳健可维护"的写法。

## 布局

- **优先流体布局**：宽度用 `auto` / 百分比 / `flex` / `grid` 自适应，避免死固定宽高
- **用 flex / grid 替代 float 做布局**；float 只留给"图文环绕"这种语义场景
- 两栏自适应：`float` + BFC、或 flex、或 grid 均可，但别用绝对定位硬算

## 盒模型与尺寸

- 全局 `box-sizing: border-box`，让 `width` 含 padding/border，心智负担更小
- 用 `min-width` / `max-width` 做弹性约束，而不是写死 `width`
- 高度尽量由内容撑开；确需定高时用 `min-height` 兜底

## 间距与对齐

- 间距用结构化的 `margin` / `padding`，避免"魔法数字"硬凑
- 垂直居中优先 `flex align-items: center`，而不是 `line-height` 硬写像素
- 统一 `vertical-align` 处理图标/图片与文字对齐

## 层级

- 控制 `z-index` 的"作用域"：在同一层叠上下文内比较，给关键容器建立独立层叠上下文（如 `isolation: isolate`）
- 避免 `z-index: 9999` 这种魔法值；用 10/20/30 等阶梯，并写注释说明层级关系

## 可维护性

- 命名语义化（BEM 或团队约定），class 名表达"是什么"，不表达"长什么样"
- 少用 `!important`（只在覆盖第三方样式等必要场景）；滥用会毁掉层叠
- 复用：抽公共 class / CSS 变量 / 预处理器 mixin
- 用 CSS 变量统一主题色、间距、字号等设计 token

## 兼容与回退

- 新特性先查兼容性，提供 `@supports` 或回退写法（如 `100vh` → `100dvh` 回退）
- 渐变、圆角、flex/grid、`aspect-ratio` 等按需加前缀或回退
- 移动端 hover 放进 `@media (hover: hover)`

## 性能

- 动画只动 `transform` / `opacity`（走合成层，不触发布局）
- 选择器别写太深（如 `.a .b .c .d`），影响匹配与可维护性
- 减少强制同步布局：批量读写，避免循环里 `offsetWidth`/`getBoundingClientRect` 与样式修改交错
- 大列表/复杂页面用 `will-change` 前先衡量，避免滥用合成层内存

## 语义与结构

- 用语义化标签（header/main/footer/nav/article/aside）
- 图片设 `width/height` 或 `aspect-ratio`，预留空间防布局抖动（CLS）
- 交互状态考虑 `:focus-visible` 可访问性
