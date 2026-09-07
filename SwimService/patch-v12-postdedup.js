const fs = require('fs');
// 读取 generate-la-sql-v12.js
const src = fs.readFileSync('generate-la-sql-v12.js', 'utf8');
// 在 "// ================== 生成 SQL（只用 Prisma 真实列！18 列，不多不少） ==================" 前面
// 插入 per-coord 后处理逻辑
const marker = '// ================== 生成 SQL（只用 Prisma 真实列！18 列，不多不少） ==================';
if (!src.includes(marker)) {
  console.error('❌ 找不到 marker，先别跑 node 了，把 generate-la-sql-v12.js 里 marker 附近 5 行贴给我');
  process.exit(1);
}
const patchCode = `
// ================== 最终 post-process：每个细 25m 格最多留 1 条最高分 ==================
// （保证结果 ≈ v11 的 4690，不爆到 2w 条）
const POST_MAX_PER_COORD = 1;
const postBucket = new Map();
for (const r of rowsInit) {
  const k = coordKeyFine(r.lat, r.lon);
  const arr = postBucket.get(k) || [];
  arr.push(r);
  postBucket.set(k, arr);
}
const S_post = { before: rowsInit.length, discarded: 0 };
const postRows = [];
for (const [k, arr] of postBucket.entries()) {
  arr.sort((a, b) => b.score - a.score);   // score 高的优先
  const keep = arr.slice(0, POST_MAX_PER_COORD);
  postRows.push(...keep);
  S_post.discarded += (arr.length - keep.length);
}
postRows.sort((a, b) => b.score - a.score);
rowsInit.length = 0;
rowsInit.push(...postRows);
console.log('📌 【最终 post-dedup】 细 25m 格每格最多 ' + POST_MAX_PER_COORD + ' 条：保留前=' + S_post.before + '，后处理丢弃=' + S_post.discarded + '，最终=' + rowsInit.length);

`;
const newSrc = src.replace(marker, patchCode + '\n' + marker);
fs.writeFileSync('generate-la-sql-v12.js', newSrc);
console.log('✅ generate-la-sql-v12.js 已打 post-dedup 补丁');
