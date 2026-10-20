import{A as d}from"./features-D6-FNglW.js";const c={ranges:{},year:null,genres:[],keys:[],mode:"any",explicit:"any",artist:"",outliers:"include",orderBy:void 0,orderDir:"desc",limit:500},l=/^[a-z_][a-z0-9_]*$/;function u(e){return`'${e.replace(/'/g,"''")}'`}function y(e){return e.replace(/\\/g,"\\\\").replace(/%/g,"\\%").replace(/_/g,"\\_")}function o(e){if(!Number.isFinite(e))throw new Error("Non-finite number in filter");return String(Math.round(e*1e6)/1e6)}function m(e){const r=[];for(const i of d){const t=e.ranges[i];t&&r.push(`${i} BETWEEN ${o(t[0])} AND ${o(t[1])}`)}for(const[i,t]of Object.entries(e.ranges))!t||d.includes(i)||l.test(i)&&r.push(`${i} BETWEEN ${o(t[0])} AND ${o(t[1])}`);e.year&&r.push(`year BETWEEN ${Math.round(e.year[0])} AND ${Math.round(e.year[1])}`),e.genres.length&&r.push(`genre IN (${e.genres.map(u).join(", ")})`);const n=e.mode==="any"?null:e.mode;if(e.keys.length){const i=e.keys.flatMap(t=>n?[`${t} ${n}`]:[`${t} major`,`${t} minor`]);r.push(`key_name IN (${i.map(u).join(", ")})`)}else n&&r.push(`mode_name = ${u(n)}`);e.explicit==="yes"&&r.push("explicit"),e.explicit==="no"&&r.push("NOT explicit");const s=e.artist.trim();return s&&r.push(`artist ILIKE ${u("%"+y(s)+"%")} ESCAPE '\\'`),e.outliers==="exclude"&&r.push("NOT is_outlier"),e.outliers==="only"&&r.push("is_outlier"),r}function g(e,r="tracks",n="*"){const s=m(e);let i=`SELECT ${n}
FROM ${r}`;s.length&&(i+=`
WHERE ${s.join(`
  AND `)}`),e.orderBy&&l.test(e.orderBy)&&(i+=`
ORDER BY ${e.orderBy} ${e.orderDir==="asc"?"ASC":"DESC"}`);const t=Math.max(1,Math.min(1e5,Math.round(e.limit||500)));return i+=`
LIMIT ${t}`,i}function h(e,r="tracks_lite.parquet"){const n=[];for(const[t,a]of Object.entries(e.ranges))a&&l.test(t)&&n.push(`df["${t}"].between(${o(a[0])}, ${o(a[1])})`);e.year&&n.push(`df["year"].between(${Math.round(e.year[0])}, ${Math.round(e.year[1])})`),e.genres.length&&n.push(`df["genre"].isin([${e.genres.map(t=>JSON.stringify(t)).join(", ")}])`);const s=e.mode==="any"?null:e.mode;if(e.keys.length){const t=e.keys.flatMap(a=>s?[`${a} ${s}`]:[`${a} major`,`${a} minor`]);n.push(`df["key_name"].isin([${t.map(a=>JSON.stringify(a)).join(", ")}])`)}else s&&n.push(`(df["mode_name"] == "${s}")`);e.explicit==="yes"&&n.push('df["explicit"]'),e.explicit==="no"&&n.push('~df["explicit"]'),e.artist.trim()&&n.push(`df["artist"].str.contains(${JSON.stringify(e.artist.trim())}, case=False, regex=False, na=False)`),e.outliers==="exclude"&&n.push('~df["is_outlier"]'),e.outliers==="only"&&n.push('df["is_outlier"]');let i=`import pandas as pd

df = pd.read_parquet("${r}")
`;return i+=n.length?`res = df[
    ${n.map(t=>`(${t})`).join(`
    & `)}
]
`:`res = df
`,e.orderBy&&l.test(e.orderBy)&&(i+=`res = res.sort_values("${e.orderBy}", ascending=${e.orderDir==="asc"?"True":"False"})
`),i+=`res = res.head(${Math.max(1,Math.round(e.limit||500))})
`,i}function $(e){return`import duckdb

con = duckdb.connect()
con.execute("CREATE VIEW tracks AS SELECT * FROM 'tracks_lite.parquet'")
df = con.execute("""
${e.trim()}
""").df()
`}function E(e){let r=Object.values(e.ranges).filter(Boolean).length;return e.year&&r++,e.genres.length&&r++,e.keys.length&&r++,e.mode!=="any"&&r++,e.explicit!=="any"&&r++,e.artist.trim()&&r++,e.outliers!=="include"&&r++,r}function f(e){const r={};return Object.keys(e.ranges).length&&(r.r=e.ranges),e.year&&(r.y=e.year),e.genres.length&&(r.g=e.genres),e.keys.length&&(r.k=e.keys),e.mode!=="any"&&(r.m=e.mode),e.explicit!=="any"&&(r.e=e.explicit),e.artist&&(r.a=e.artist),e.outliers!=="include"&&(r.o=e.outliers),e.orderBy&&(r.s=[e.orderBy,e.orderDir??"desc"]),e.limit!==c.limit&&(r.l=e.limit),JSON.stringify(r)}function A(e){if(!e)return{...c,ranges:{}};try{const r=JSON.parse(e),n={};if(r.r&&typeof r.r=="object")for(const[s,i]of Object.entries(r.r))Array.isArray(i)&&i.length===2&&i.every(t=>typeof t=="number")&&l.test(s)&&(n[s]=[i[0],i[1]]);return{ranges:n,year:Array.isArray(r.y)&&r.y.length===2?[Number(r.y[0]),Number(r.y[1])]:null,genres:Array.isArray(r.g)?r.g.map(String):[],keys:Array.isArray(r.k)?r.k.map(String):[],mode:r.m==="major"||r.m==="minor"?r.m:"any",explicit:r.e==="yes"||r.e==="no"?r.e:"any",artist:typeof r.a=="string"?r.a:"",outliers:r.o==="exclude"||r.o==="only"?r.o:"include",orderBy:Array.isArray(r.s)&&l.test(String(r.s[0]))?String(r.s[0]):void 0,orderDir:Array.isArray(r.s)&&r.s[1]==="asc"?"asc":"desc",limit:typeof r.l=="number"?r.l:c.limit}}catch{return{...c,ranges:{}}}}export{c as D,E as a,g as b,A as d,f as e,y as l,u as q,$ as s,h as t};
