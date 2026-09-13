# zhangxinxu-css

> 一个面向「浏览器样式（CSS）**最佳实践 · 问题定位 · 诡异 bug 分析**」的 Agent Skill。
> 方法论受张鑫旭（《CSS 世界》《CSS 新世界》作者，博客 [zhangxinxu.com](https://www.zhangxinxu.com/)）启发，核心原则：**先理解 CSS 内在机制，再谈修复**。

> ⚠️ 本项目为非官方社区作品，与张鑫旭本人无关；内容为对其方法论与公开知识的整理总结。

## 这是什么

一个符合 [Agent Skills 规范](https://agentskills.io/specification) 的 skill（Pi / Claude 等 harness 通用）。它让 agent 用「**现象 → 根因 → 修复**」的方式排查 CSS 问题，而不是贴一段放之四海皆准的通用答案。

核心信条：**能说清楚「为什么」，才叫修好；否则 bug 会换个马甲回来。**

## 能力范围

- **最佳实践**：流体布局、盒模型与尺寸、间距对齐、层级管理、可维护性、兼容回退、渲染性能
- **问题定位**：最小化复现、二分排除、DevTools 三板斧、症状归类表、排除干扰清单
- **诡异 bug 分析**：18 个经典案例，每个都归因到具体机制（z-index 无效、margin 穿透、高度塌陷、inline-block 间隙、图片底部空隙、absolute 参照错乱、sticky 失效、fixed+transform、100vh 移动端……）

## 目录结构

```
zhangxinxu-css/
├── SKILL.md                      # 主入口：使用场景 + 5 步排查流程
└── references/                   # 按需加载的深度资料
    ├── css-mechanisms.md         # CSS 内在机制：层叠、BFC/IFC、外边距合并、包含块、基线、尺寸计算、渲染
    ├── common-bugs.md            # 经典诡异 bug 案例库
    ├── debugging.md              # 问题定位与调试方法
    └── best-practices.md         # 最佳实践与代码规范
```

> Skill 采用「渐进式披露」：只有描述常驻上下文，完整内容在命中任务时才加载。

## 安装

### 方式一：克隆到全局 skills 目录（推荐）

```bash
# macOS / Linux
cd ~/.pi/agent/skills
git clone https://github.com/<你的用户名>/zhangxinxu-css.git

# Windows (PowerShell / Git Bash)
cd $HOME/.pi/agent/skills
git clone https://github.com/<你的用户名>/zhangxinxu-css.git
```

### 方式二：在 settings.json 中声明路径

```json
{
  "skills": ["~/path/to/zhangxinxu-css"]
}
```

## 使用

- 重启 pi 后，agent 会在遇到 CSS 疑难问题时自动加载
- 也可手动触发：`/skill:zhangxinxu-css`
- 直接提问亦可，例如：_"为什么这个 z-index 不管用？"_、_"帮我分析这个布局错乱"_

## 贡献

欢迎提交 issue / PR，尤其是**真实项目里踩过的诡异 bug**（附最小复现最佳）。

## 许可

[MIT](LICENSE)
