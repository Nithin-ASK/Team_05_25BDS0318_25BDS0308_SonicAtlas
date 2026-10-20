import{j as t}from"./codemirror-D5M76DWd.js";import{a as x}from"./react-BinVGxRz.js";import{c as h,o as j}from"./index-D6q7taTS.js";/**
 * @license lucide-react v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]],S=h("arrow-down",_);/**
 * @license lucide-react v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]],M=h("arrow-up",k);/**
 * @license lucide-react v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],D=h("chevron-left",$);/**
 * @license lucide-react v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],I=h("chevron-right",E);function q(r){return r==null?"—":typeof r=="number"?Number.isInteger(r)?String(r):Math.abs(r)>=100?r.toFixed(1):r.toFixed(3):typeof r=="boolean"?r?"true":"false":typeof r=="object"?JSON.stringify(r):String(r)}function L({columns:r,rows:c,pageSize:m=25,caption:p,onRowClick:n,rowLabel:f}){const[s,N]=x.useState(null),[u,b]=x.useState(0);x.useEffect(()=>{b(0)},[c]);const g=x.useMemo(()=>{if(!s)return c;const{col:e,dir:o}=s;return[...c].sort((a,i)=>{const l=a[e],d=i[e];return l===d?0:l==null?1:d==null?-1:(typeof l=="number"&&typeof d=="number"?l-d:String(l).localeCompare(String(d)))*o})},[c,s]),y=Math.max(1,Math.ceil(g.length/m)),v=g.slice(u*m,u*m+m),w=e=>N(o=>o?.col===e?o.dir===1?{col:e,dir:-1}:null:{col:e,dir:1});return t.jsxs("div",{children:[t.jsx("div",{className:"scrollbar-thin overflow-auto rounded-lg border border-border",tabIndex:0,role:"region","aria-label":p,children:t.jsxs("table",{className:"w-full min-w-max border-collapse text-sm",children:[t.jsx("caption",{className:"sr-only",children:p}),t.jsx("thead",{className:"sticky top-0 z-10 bg-muted",children:t.jsx("tr",{children:r.map(e=>t.jsx("th",{scope:"col","aria-sort":s?.col===e?s.dir===1?"ascending":"descending":"none",className:"border-b border-border px-3 py-2 text-left text-xs font-semibold text-subtle",children:t.jsxs("button",{type:"button",onClick:()=>w(e),className:"inline-flex items-center gap-1 hover:text-fg",children:[e,s?.col===e&&(s.dir===1?t.jsx(M,{className:"h-3 w-3","aria-hidden":!0}):t.jsx(S,{className:"h-3 w-3","aria-hidden":!0}))]})},e))})}),t.jsx("tbody",{children:v.map((e,o)=>t.jsx("tr",{className:j("border-b border-border/60 last:border-0 hover:bg-muted/60",n&&"cursor-pointer"),onClick:n?()=>n(e):void 0,onKeyDown:n?a=>{a.key==="Enter"&&n(e)}:void 0,tabIndex:n?0:void 0,"aria-label":n&&f?f(e):void 0,children:r.map(a=>{const i=e[a];return t.jsx("td",{className:j("max-w-[280px] truncate px-3 py-1.5",typeof i=="number"&&"text-right font-mono text-xs tabular-nums"),title:typeof i=="string"?i:void 0,children:q(i)},a)})},o))})]})}),t.jsxs("div",{className:"mt-2 flex items-center justify-between text-xs text-subtle",children:[t.jsxs("span",{children:[c.length.toLocaleString("en-US")," rows",s?` - sorted by ${s.col} ${s.dir===1?"ascending":"descending"}`:""]}),t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx("button",{type:"button",className:"btn-ghost btn-sm",disabled:u===0,onClick:()=>b(e=>e-1),"aria-label":"Previous page",children:t.jsx(D,{className:"h-4 w-4","aria-hidden":!0})}),t.jsxs("span",{"aria-live":"polite",children:["Page ",u+1," of ",y]}),t.jsx("button",{type:"button",className:"btn-ghost btn-sm",disabled:u>=y-1,onClick:()=>b(e=>e+1),"aria-label":"Next page",children:t.jsx(I,{className:"h-4 w-4","aria-hidden":!0})})]})]})]})}export{L as D};
