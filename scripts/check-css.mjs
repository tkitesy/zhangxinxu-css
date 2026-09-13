#!/usr/bin/env node
/**
 * check-css.mjs — 静态 CSS 陷阱扫描器（零依赖，Node >= 14）
 *
 * 用法:
 *   node check-css.mjs <文件.css|文件.html> [...]
 *   node check-css.mjs src/**\/*.css --json      # 机器可读输出
 *   node check-css.mjs src/style.css --strict    # 有 error 时退出码为 1
 *
 * 支持 .css 与 .html（自动提取 <style> 块与 style="" 行内样式）。
 * 设计原则：只报“从 CSS 文本即可确定”的问题，避免误报；不确定的一律用 info。
 */

import { readFileSync } from 'node:fs';

/* ------------------------- CLI ------------------------- */
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');
const files = argv.filter((a) => !a.startsWith('--'));

if (files.length === 0) {
  console.error('用法: node check-css.mjs <文件.css|文件.html> [...] [--json] [--strict]');
  process.exit(2);
}

/* ------------------------- 常量 ------------------------- */
const INLINE_TAGS = new Set([
  'span', 'a', 'em', 'strong', 'b', 'i', 'u', 's', 'small', 'big', 'label',
  'code', 'abbr', 'cite', 'q', 'sub', 'sup', 'time', 'mark', 'kbd', 'samp',
  'var', 'dfn', 'bdi', 'bdo', 'ruby', 'rt', 'rp', 'wbr',
]);

// 这些属性若写成纯数字（非 0）即为非法值，浏览器会忽略整条声明
const LENGTH_PROPS = new Set([
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'top', 'right', 'bottom', 'left', 'inset',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'font-size', 'letter-spacing', 'word-spacing',
  'text-indent', 'border-radius', 'border-width',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'outline-width', 'flex-basis', 'translate',
]);

const DISPLAY_KEYWORDS = new Set([
  'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid',
  'flow-root', 'none', 'contents', 'list-item', 'table', 'inline-table',
  'table-row', 'table-cell', 'table-caption', 'table-column', 'table-column-group',
  'table-footer-group', 'table-header-group', 'table-row-group', 'ruby', 'ruby-base',
  'ruby-text', 'run-in', 'inline-flow-root',
]);

const POSITION_KEYWORDS = new Set(['static', 'relative', 'absolute', 'fixed', 'sticky']);

const NON_ANIMATABLE = new Set([
  'display', 'position', 'float', 'clear', 'overflow', 'visibility', 'content',
  'z-index', 'top', 'left', 'right', 'bottom', 'width', 'height',
]);

const PURE_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const LENGTH_UNIT = /^-?(?:\d+\.?\d*|\.\d+)(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc|fr|deg|s|ms)$/;
const PSEUDO_BEFORE_AFTER = /::?(before|after)\b/i;

/* ------------------------- 极简 CSS 解析 ------------------------- */
function parseCss(css) {
  const lineStarts = [0];
  for (let k = 0; k < css.length; k++) if (css[k] === '\n') lineStarts.push(k + 1);
  const lineOf = (pos) => {
    let lo = 0, hi = lineStarts.length - 1, a = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (lineStarts[m] <= pos) { a = m; lo = m + 1; } else hi = m - 1;
    }
    return a + 1;
  };

  const rules = [];

  const parseDecls = (s, e) => {
    const out = [];
    let i = s;
    while (i < e) {
      while (i < e && (css[i] === ';' || /\s/.test(css[i]))) i++;
      if (i >= e) break;
      const dStart = i;
      let depth = 0, semi = -1;
      while (i < e) {
        const c = css[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === ';' && depth === 0) { semi = i; break; }
        i++;
      }
      const end = semi < 0 ? e : semi;
      const raw = css.slice(dStart, end);
      const colon = raw.indexOf(':');
      if (colon > -1) {
        const prop = raw.slice(0, colon).trim().toLowerCase();
        const value = raw.slice(colon + 1).trim();
        if (prop && /^[-a-z*]/.test(prop) && value) {
          out.push({ prop, value, line: lineOf(dStart), raw: raw.trim() });
        }
      }
      i = semi < 0 ? e : semi + 1;
    }
    return out;
  };

  const parseRange = (s, e, at) => {
    let i = s;
    while (i < e) {
      while (i < e && /\s/.test(css[i])) i++;
      if (i >= e) break;
      const ruleStart = i;
      let depth = 0, brace = -1;
      while (i < e) {
        const c = css[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (depth === 0 && c === '{') { brace = i; break; }
        else if (depth === 0 && (c === ';' || c === '}')) break;
        i++;
      }
      if (brace < 0) {
        while (i < e && css[i] !== ';' && css[i] !== '}') i++;
        if (i < e && css[i] === ';') i++;
        continue;
      }
      const prelude = css.slice(ruleStart, brace).trim();
      let j = brace + 1, bd = 1;
      while (j < e && bd > 0) {
        const c = css[j];
        if (c === '{') bd++;
        else if (c === '}') bd--;
        j++;
      }
      const bodyEnd = j - 1;

      if (prelude.startsWith('@')) {
        const name = prelude.split(/[\s({]/)[0].toLowerCase();
        if (/@(media|supports|layer|container|scope)$/.test(name)) {
          parseRange(brace + 1, bodyEnd, (at ? at + ' ' : '') + prelude);
        } else if (!name.endsWith('keyframes')) {
          rules.push({ selector: prelude, at, decls: parseDecls(brace + 1, bodyEnd), line: lineOf(ruleStart) });
        }
      } else {
        rules.push({ selector: prelude, at, decls: parseDecls(brace + 1, bodyEnd), line: lineOf(ruleStart) });
      }
      i = j;
    }
  };

  parseRange(0, css.length, '');
  return rules;
}

/* ------------------------- 工具 ------------------------- */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const hasImportant = (v) => /!\s*important/i.test(v);
const tokens = (v) => v.split(/\s+/).filter(Boolean);
const lastCompound = (selectorPart) => selectorPart.split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() || '';
const elementOf = (selectorPart) => {
  const m = lastCompound(selectorPart).match(/^([a-zA-Z][\w-]*)/);
  return m ? m[1].toLowerCase() : '';
};
const selectorParts = (selector) => selector.split(',').map((s) => s.trim()).filter(Boolean);

function getDecl(decls, prop) {
  let found = null;
  for (const d of decls) if (d.prop === prop) found = d; // 后者生效
  return found;
}

/* ------------------------- 规则集 ------------------------- */
/** @type {(rule:{selector:string,at:string,decls:Array,line:number,tag?:string})=>Array} */
const CHECKS = [
  // 伪元素缺 content
  function pseudoNoContent(rule) {
    const out = [];
    if (!PSEUDO_BEFORE_AFTER.test(rule.selector)) return out;
    if (getDecl(rule.decls, 'content')) return out;
    out.push({
      sev: 'error', line: rule.line, selector: rule.selector, prop: 'content',
      msg: '::before/::after 没有 content 属性，伪元素不会被生成',
      fix: '补上 `content: ""`（哪怕是空字符串）',
    });
    return out;
  },

  // z-index 但没有 position
  function zIndexNoPosition(rule) {
    const out = [];
    const z = getDecl(rule.decls, 'z-index');
    if (!z || /^auto$/i.test(z.value)) return out;
    if (getDecl(rule.decls, 'position')) return out;
    out.push({
      sev: 'warn', line: z.line, selector: rule.selector, prop: 'z-index',
      msg: `设置了 z-index:${z.value} 但本规则没有 position —— 若该元素不是 flex/grid 子项，z-index 会被忽略`,
      fix: '加 `position: relative`（或确认它确是 flex/grid 子项）',
    });
    return out;
  },

  // 长度值缺单位
  function unitlessLength(rule) {
    const out = [];
    for (const d of rule.decls) {
      if (!LENGTH_PROPS.has(d.prop)) continue;
      for (const t of tokens(d.value)) {
        if (t.includes('(') || t.includes('var')) continue;
        if (PURE_NUMBER.test(t) && parseFloat(t) !== 0) {
          out.push({
            sev: 'error', line: d.line, selector: rule.selector, prop: d.prop,
            msg: `值 \`${t}\` 缺少单位，整条 \`${d.prop}\` 声明会被浏览器忽略`,
            fix: `补单位，如 \`${t}px\`（0 可省略单位）`,
          });
          break;
        }
      }
    }
    return out;
  },

  // display / position 值拼写
  function invalidKeyword(rule) {
    const out = [];
    const dm = rule.decls.find((d) => d.prop === 'display');
    if (dm) {
      const kw = tokens(dm.value).map((s) => s.toLowerCase());
      if (!kw.some((k) => DISPLAY_KEYWORDS.has(k))) {
        out.push({
          sev: 'error', line: dm.line, selector: rule.selector, prop: 'display',
          msg: `display 值 \`${dm.value}\` 不是合法关键字（如 flexbox），声明会被忽略`,
          fix: '检查拼写，常用值如 flex / grid / inline-block / flow-root',
        });
      }
    }
    const pm = rule.decls.find((d) => d.prop === 'position');
    if (pm && !POSITION_KEYWORDS.has(pm.value.toLowerCase())) {
      out.push({
        sev: 'error', line: pm.line, selector: rule.selector, prop: 'position',
        msg: `position 值 \`${pm.value}\` 非法，声明会被忽略`,
        fix: 'static / relative / absolute / fixed / sticky',
      });
    }
    return out;
  },

  // 同一规则里重复声明
  function duplicateDecl(rule) {
    const out = [];
    const seen = new Map();
    for (const d of rule.decls) {
      if (seen.has(d.prop)) {
        out.push({
          sev: 'info', line: seen.get(d.prop).line, selector: rule.selector, prop: d.prop,
          msg: `\`${d.prop}\` 重复声明，前面这条被后面的覆盖（若是有意的回退写法可忽略）`,
          fix: '删除失效声明，或确认回退顺序正确',
        });
      }
      seen.set(d.prop, d);
    }
    return out;
  },

  // 百分比高度
  function percentHeight(rule) {
    const out = [];
    for (const prop of ['height', 'min-height', 'max-height']) {
      const d = getDecl(rule.decls, prop);
      if (d && /^-?\d*\.?\d+%$/.test(d.value.trim())) {
        out.push({
          sev: 'info', line: d.line, selector: rule.selector, prop,
          msg: `${prop} 用了百分比，要求父级有“明确高度”，否则该值无效（高度塌陷常见根因）`,
          fix: '给父级设明确高度，或改用 flex/grid 拉伸、vh、aspect-ratio',
        });
      }
    }
    return out;
  },

  // inline 元素的垂直 margin
  function inlineVerticalMargin(rule) {
    const out = [];
    const dm = getDecl(rule.decls, 'display');
    let computeInline;
    if (dm) computeInline = dm.value.trim().toLowerCase() === 'inline';
    else if (rule.tag) computeInline = INLINE_TAGS.has(rule.tag);
    else computeInline = selectorParts(rule.selector).some((p) => INLINE_TAGS.has(elementOf(p)));
    if (!computeInline) return out;
    const vert = rule.decls.filter((d) =>
      ['margin-top', 'margin-bottom'].includes(d.prop) ||
      (d.prop === 'margin' && tokens(d.value).length >= 2));
    for (const d of vert) {
      out.push({
        sev: 'warn', line: d.line, selector: rule.selector, prop: d.prop,
        msg: '非替换行内元素的垂直 margin 不生效（不影响布局）',
        fix: '改为 inline-block / block / flex，或对父级用 line-height/padding',
      });
    }
    return out;
  },

  // vertical-align 用在块级
  function verticalAlignOnBlock(rule) {
    const out = [];
    const va = getDecl(rule.decls, 'vertical-align');
    if (!va) return out;
    const dm = getDecl(rule.decls, 'display');
    const blockish = dm && /^(block|flex|grid|list-item|flow-root|table)$/i.test(dm.value.trim());
    if (blockish) {
      out.push({
        sev: 'warn', line: va.line, selector: rule.selector, prop: 'vertical-align',
        msg: `vertical-align 对 display:${dm.value.trim()} 的元素无效（只作用于内联/表格单元格）`,
        fix: '对内联元素或表格单元格使用；居中优先 flex/grid',
      });
    }
    return out;
  },

  // float + flex/grid display 冲突
  function floatVsFlex(rule) {
    const out = [];
    const fm = getDecl(rule.decls, 'float');
    const dm = getDecl(rule.decls, 'display');
    if (fm && dm && /^(flex|inline-flex|grid|inline-grid)$/i.test(dm.value.trim())) {
      out.push({
        sev: 'warn', line: fm.line, selector: rule.selector, prop: 'float',
        msg: `同一元素既是 ${dm.value.trim()} 容器又设了 float，float 会被忽略`,
        fix: '删除 float；布局交给 flex/grid',
      });
    }
    return out;
  },

  // float 未清除提示
  function floatReminder(rule) {
    const out = [];
    const fm = getDecl(rule.decls, 'float');
    const dm = getDecl(rule.decls, 'display');
    // 已被 floatVsFlex 提示过的，不再重复
    if (dm && /^(flex|inline-flex|grid|inline-grid)$/i.test(dm.value.trim())) return out;
    if (fm && !/^none$/i.test(fm.value.trim())) {
      out.push({
        sev: 'info', line: fm.line, selector: rule.selector, prop: 'float',
        msg: '使用了 float，父容器需形成 BFC 或清除浮动，否则可能高度塌陷',
        fix: '父级用 `display: flow-root`；新代码建议改用 flex/grid',
      });
    }
    return out;
  },

  // absolute/fixed/sticky 缺偏移
  function positionNoOffset(rule) {
    const out = [];
    const pm = getDecl(rule.decls, 'position');
    if (!pm) return out;
    const pos = pm.value.trim().toLowerCase();
    if (!['absolute', 'fixed', 'sticky'].includes(pos)) return out;
    const hasOffset = ['top', 'right', 'bottom', 'left', 'inset'].some((p) => getDecl(rule.decls, p));
    if (!hasOffset) {
      out.push({
        sev: pos === 'sticky' ? 'warn' : 'info',
        line: pm.line, selector: rule.selector, prop: 'position',
        msg: pos === 'sticky'
          ? 'position: sticky 未设置 top/right/bottom/left，不会产生吸顶效果'
          : `position: ${pos} 未设置偏移，元素会停留在原 static 位置`,
        fix: pos === 'sticky' ? '必须设置 top/left 等阈值' : '补上 top/left 等偏移值',
      });
    }
    if (pos === 'sticky') {
      out.push({
        sev: 'info', line: pm.line, selector: rule.selector, prop: 'position',
        msg: 'sticky 若失效，优先检查祖先是否设置了 overflow(hidden/auto/scroll) 或没有滚动空间',
        fix: '移除祖先的 overflow 限制，确保父级有可滚动高度',
      });
    }
    return out;
  },

  // margin auto 居中却没宽度
  function marginAutoNoWidth(rule) {
    const out = [];
    const mm = getDecl(rule.decls, 'margin');
    const ml = getDecl(rule.decls, 'margin-left');
    const mr = getDecl(rule.decls, 'margin-right');
    const autoCenter = (mm && /\bauto\b/i.test(mm.value) && tokens(mm.value).length >= 2)
      || (ml && /auto/i.test(ml.value) && mr && /auto/i.test(mr.value));
    if (!autoCenter) return out;
    if (getDecl(rule.decls, 'width') || getDecl(rule.decls, 'max-width') || getDecl(rule.decls, 'inline-size')) return out;
    out.push({
      sev: 'info', line: (mm || ml).line, selector: rule.selector, prop: 'margin',
      msg: 'margin:auto 居中需要元素有明确宽度，否则块级元素会自动撑满、居中无意义',
      fix: '补 `width` / `max-width`',
    });
    return out;
  },

  // transition 不可动画属性 / all
  function transitionIssue(rule) {
    const out = [];
    for (const prop of ['transition', 'transition-property']) {
      const d = getDecl(rule.decls, prop);
      if (!d) continue;
      const toks = tokens(d.value.replace(/,/g, ' ')).map((s) => s.toLowerCase());
      if (toks.includes('all')) {
        out.push({
          sev: 'info', line: d.line, selector: rule.selector, prop,
          msg: 'transition 使用 all，可能触发意料之外的过渡与性能开销',
          fix: '只过渡需要的属性，如 `transition: transform .2s, opacity .2s`',
        });
      }
      for (const t of toks) {
        if (NON_ANIMATABLE.has(t) && !['top', 'left', 'right', 'bottom', 'width', 'height'].includes(t)) {
          out.push({
            sev: 'warn', line: d.line, selector: rule.selector, prop,
            msg: `\`${t}\` 不是可过渡属性，transition 对它无效`,
            fix: '改用 opacity / transform 等可合成属性',
          });
          break;
        }
      }
    }
    return out;
  },

  // !important
  function importantUsage(rule) {
    const out = [];
    for (const d of rule.decls) {
      if (hasImportant(d.value)) {
        out.push({
          sev: 'info', line: d.line, selector: rule.selector, prop: d.prop,
          msg: '使用了 !important，会破坏层叠、增加维护成本',
          fix: '优先通过调整选择器权重/顺序解决；仅覆盖第三方样式时使用',
        });
      }
    }
    return out;
  },

  // ID 选择器
  function idSelector(rule) {
    const out = [];
    if (/#[A-Za-z_][\w-]*/.test(rule.selector)) {
      out.push({
        sev: 'info', line: rule.line, selector: rule.selector, prop: '(selector)',
        msg: '使用了 ID 选择器，权重过高且不可复用，容易引发“样式覆盖不动”',
        fix: '改用 class',
      });
    }
    return out;
  },

  // 0 带单位
  function zeroUnit(rule) {
    const out = [];
    for (const d of rule.decls) {
      for (const t of tokens(d.value)) {
        if (/^0(px|em|rem|ex|ch|cm|mm|in|pt|pc)$/.test(t)) {
          out.push({
            sev: 'info', line: d.line, selector: rule.selector, prop: d.prop,
            msg: `\`0${t.replace(/^0/, '')}\` 可简写为 \`0\``,
            fix: '去掉单位（仅风格问题）',
          });
          break;
        }
      }
    }
    return out;
  },

  // overflow:hidden 在根元素
  function overflowOnRoot(rule) {
    const out = [];
    const om = getDecl(rule.decls, 'overflow');
    const omY = getDecl(rule.decls, 'overflow-y');
    const hidden = (om && /hidden/i.test(om.value)) || (omY && /hidden/i.test(omY.value));
    if (hidden && /(^|[\s,>])(html|body|:root)($|[\s,{])/i.test(rule.selector)) {
      out.push({
        sev: 'warn', line: (om || omY).line, selector: rule.selector, prop: 'overflow',
        msg: 'html/body 上使用 overflow:hidden 会禁用整页滚动，且可能切断 sticky 的滚动容器',
        fix: '确认意图；多数情况应避免在根元素裁剪',
      });
    }
    return out;
  },
];

/* ------------------------- HTML 提取 ------------------------- */
function extractFromHtml(html) {
  const results = [];
  // <style> 块
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(html))) {
    const css = stripComments(m[1]);
    const offset = m.index + m[0].indexOf('>') + 1;
    const baseLine = (html.slice(0, offset).match(/\n/g) || []).length + 1;
    for (const r of parseCss(css)) {
      results.push({ ...r, line: r.line + baseLine - 1 });
    }
  }
  // style="" 行内样式
  const inlineRe = /<([a-zA-Z][\w-]*)\b[^>]*\bstyle\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi;
  while ((m = inlineRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const styleText = m[3] != null ? m[3] : m[4];
    const line = (html.slice(0, m.index).match(/\n/g) || []).length + 1;
    const decls = [];
    for (const raw of styleText.split(';')) {
      const colon = raw.indexOf(':');
      if (colon > -1) {
        const prop = raw.slice(0, colon).trim().toLowerCase();
        const value = raw.slice(colon + 1).trim();
        if (prop && value) decls.push({ prop, value, line, raw: raw.trim() });
      }
    }
    if (decls.length) {
      results.push({ selector: `<${tag} style="...">`, at: '', decls, line, tag });
    }
  }
  return results;
}

/* ------------------------- 主流程 ------------------------- */
function analyze(file) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (e) {
    return { file, error: `无法读取: ${e.message}`, issues: [] };
  }
  const cleaned = stripComments(src);
  const rules = file.toLowerCase().endsWith('.html') || /<html|<style|<div|<body/i.test(src)
    ? extractFromHtml(src)
    : parseCss(cleaned);

  const issues = [];
  for (const rule of rules) {
    for (const check of CHECKS) {
      for (const it of check(rule)) issues.push(it);
    }
  }
  issues.sort((a, b) => a.line - b.line);
  return { file, rules: rules.length, issues };
}

const reports = files.map(analyze);

/* ------------------------- 输出 ------------------------- */
const SEV_LABEL = { error: '✖ ERROR', warn: '▲ WARN ', info: '· INFO ' };

if (asJson) {
  const total = reports.reduce((n, r) => n + r.issues.length, 0);
  console.log(JSON.stringify({ reports, total }, null, 2));
} else {
  let errors = 0, warns = 0, infos = 0;
  for (const rep of reports) {
    console.log(`\n📄 ${rep.file}`);
    if (rep.error) { console.log(`   ${rep.error}`); continue; }
    if (rep.issues.length === 0) { console.log('   ✅ 未发现明显问题'); continue; }
    for (const it of rep.issues) {
      if (it.sev === 'error') errors++;
      else if (it.sev === 'warn') warns++;
      else infos++;
      console.log(`\n   ${SEV_LABEL[it.sev]}  L${it.line}  ${it.selector}`);
      console.log(`      属性: ${it.prop}`);
      console.log(`      现象: ${it.msg}`);
      console.log(`      建议: ${it.fix}`);
    }
  }
  console.log(`\n──────────────\n总计: ${errors} error, ${warns} warn, ${infos} info`);
  console.log('提示: 这些是“静态可判定”的陷阱；涉及 DOM 结构的问题（如 margin 穿透、包含块）请结合浏览器开发者工具确认。');
  if (strict && errors > 0) process.exit(1);
}
