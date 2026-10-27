#!/usr/bin/env node
// EP별 공유 페이지 만들기 — 저장소 맨 위 폴더에서:  node tools/build.mjs   (Node 18 이상, 설치할 패키지 없음)
//
// 하는 일
// 1. data/looks/NNN.json마다 looks/NNN/index.html을 만든다. look.html이 틀이고, <head>의 제목·설명·미리보기 사진(og 태그)만 그 EP 것으로 바꾼다.
//    카톡 같은 메신저는 HTML에 처음부터 적힌 og 태그를 읽기 때문에(자바스크립트로 바꾼 태그는 믿을 수 없음) EP마다 파일이 따로 있어야 한다.
// 2. data/looks/index.json을 {"ids": [...], "pages": true}로 새로 쓴다 → 홈 카드가 looks/NNN/으로 가고, 예전 주소 look.html?ep=NNN도 그리로 옮겨 간다.
// 3. JSON 칸과 글 규칙(후기성 표현 등)을 점검한다. 경고는 알려 주기만 하고, 꼭 필요한 칸이 없는 EP는 건너뛴다(그 EP는 홈에도 안 나옴).
//
// 미리보기 사진: JSON의 ogImage → img/epNNN/og.jpg(1200×630, tools/og.html로 만듦) → 둘 다 없으면 사이트 og.jpg.
// 사이트 주소는 index.html의 og:url에서 읽는다. 도메인을 바꿨다면 index.html의 og:url만 고치면 된다(또는 SITE_URL=https://… node tools/build.mjs).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = p => join(ROOT, p);
const exists = p => existsSync(file(p));
const read = p => readFileSync(file(p));
const isUrl = p => /^[a-z][a-z\d+.-]*:|^\/\//i.test(p);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hash = buf => createHash('sha1').update(buf).digest('hex').slice(0, 8);

const SHOPS = { 에이블리: /(^|\.)a-bly\.com$/, 쿠팡: /(^|\.)(coupang\.com|coupa\.ng)$/, 무신사: /(^|\.)musinsa\.com$/ };
// 글 규칙: 가상인물이라 실제로 입어 본 듯한 말(보온·핏·사이즈 후기)은 쓰지 않는다. 운영 규칙(수능·빼빼로데이 표현 금지)도 같이 본다
const BANNED = [
  [/입어\s?보(니|았|면|고)|입어\s?봤|신어\s?보|신어\s?봤|착용(해\s?보|감|후기)/, '직접 입어 본 듯한 표현'],
  [/따뜻(해요|했어요|하더라|했다)|보온/, '보온 후기 표현'],
  [/정\s?사이즈|사이즈\s?(업|다운|추천)|한\s?치수/, '사이즈 후기 표현'],
  [/핏이?\s?(좋아|좋았|예뻐|딱)/, '핏 후기 표현'],
  [/수능|빼빼로/, '운영 규칙(수능·빼빼로데이 표현 금지)'],
];

const ytId = v => {
  const s = String(v || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(u.hostname)) return '';
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || (u.hostname.endsWith('youtu.be') ? u.pathname.match(/^\/([\w-]{11})/) : null);
    const id = m ? m[1] : u.searchParams.get('v') || '';
    return /^[\w-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
};

// 그림 파일 머리에서 가로·세로를 읽는다 (JPG·PNG·WebP). og:image:width/height에 쓴다
function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const f = b.toString('ascii', 12, 16);
    if (f === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (f === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') { const x = b.readUInt32LE(21); return { w: 1 + (x & 0x3fff), h: 1 + ((x >> 14) & 0x3fff) }; }
  }
  return null;
}

// ── 틀과 사이트 주소 ──
const SITE = (process.env.SITE_URL || read('index.html').toString().match(/property="og:url" content="([^"]+)"/)?.[1] || '').replace(/\/*$/, '/');
const TEMPLATE = read('look.html').toString();
const META = /<!-- page-meta -->[\s\S]*?<!-- \/page-meta -->/;
if (!/^https:\/\//.test(SITE)) { console.error('✗ 사이트 주소를 못 찾았어요. index.html의 og:url을 확인하거나 SITE_URL을 주세요.'); process.exit(1); }
if (!META.test(TEMPLATE) || !TEMPLATE.includes('<body class="detail">')) {
  console.error('✗ look.html에 <!-- page-meta --> … <!-- /page-meta --> 표시나 <body class="detail">가 없어요.'); process.exit(1);
}
// 틀(look.html)은 맨 위 폴더 기준 상대 경로라, 두 단계 아래(looks/NNN/)에서 쓰도록 ../../ 를 붙인다 (http:·data:·#·/ 로 시작하는 건 그대로)
const relocate = html => html.replace(/\b(href|src)="(?![a-z][a-z\d+.-]*:|\/|#)([^"]*)"/gi, (_, a, p) => `${a}="../../${p.replace(/^\.\/?/, '')}"`);
const BASE = relocate(TEMPLATE);
// 홈 룩 지도의 색 묶음 표(assets/home.js의 COLORS)에 있는 색 이름. 없는 색은 컬러 칩에 안 잡히니 알려 준다
const COLOR_NAMES = new Set([...read('assets/home.js').toString().matchAll(/\[\s*'[^']+',\s*'#[0-9a-fA-F]{3,8}',\s*\[([^\]]*)\]\s*\]/g)]
  .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])));

// ── EP 하나 점검 ──
function check(look, id) {
  const errs = [], warns = [], notes = [];
  const need = (ok, msg) => { if (!ok) errs.push(msg); };
  need(look.id === id, `id가 파일 번호와 달라요 ("${look.id}" ≠ "${id}")`);
  need(typeof look.title === 'string' && look.title.trim(), 'title이 없어요');
  need(Array.isArray(look.sets) && look.sets.length, 'sets(룩 목록)가 비었어요');
  if (errs.length) return { errs, warns, notes };

  const fileOk = (p, what) => { if (p && !isUrl(p) && !exists(p)) warns.push(`${what} 파일이 없어요: ${p}`); };
  const texts = [['title', look.title], ['headline', look.headline], ['summary', look.summary], ['description', look.description]];
  if (look.youtubeId && !ytId(look.youtubeId)) warns.push(`youtubeId를 못 알아봤어요: "${look.youtubeId}" (11자 영상 번호나 쇼츠 주소)`);
  fileOk(look.cover, 'cover');
  fileOk(look.instagramThumb, 'instagramThumb');
  let empty = 0;
  look.sets.forEach((s, i) => {
    const at = `sets[${i}]`;
    need(s.name, `${at}.name이 없어요`);
    need(s.image, `${at}.image가 없어요`);
    need(s.alt, `${at}.alt가 없어요`);
    need(Array.isArray(s.items), `${at}.items가 없어요`);
    fileOk(s.image, `${at}.image`);
    if (i > 0 && s.image) fileOk(s.image.replace(/(\.\w+)$/, '-s$1'), `${at} 홈 썸네일`);
    (s.extra || []).forEach((m, j) => fileOk(m.image, `${at}.extra[${j}]`));
    if (s.reel) fileOk(s.reelThumb || s.image?.replace(/(\.\w+)$/, '-s$1'), `${at} 릴스 카드 사진`);
    if (s.youtubeId && !ytId(s.youtubeId)) warns.push(`${at}.youtubeId를 못 알아봤어요: "${s.youtubeId}"`);
    if (s.loopMp4) {
      fileOk(s.loopMp4, `${at}.loopMp4`);
      if (!/\.(mp4|webm)$/i.test(s.loopMp4)) warns.push(`${at}.loopMp4는 .mp4(H.264)를 권해요: ${s.loopMp4}`);
    }
    texts.push([`${at}.name`, s.name], [`${at}.mood`, s.mood]);
    (Array.isArray(s.items) ? s.items : []).forEach((it, k) => {
      const where = `${at}.items[${k}] ${it.name || ''}`.trim();
      if (!it.cat || !it.name) warns.push(`${where}: cat·name이 비었어요`);
      texts.push([`${where} note`, it.note]);
      if (!it.url) { empty++; return; } // 주소가 빈 칸 = 아직 안 쓰는 상점 자리. 화면에 안 나온다
      let host = '';
      try { const u = new URL(it.url); host = u.hostname; if (u.protocol !== 'https:') throw 0; }
      catch { warns.push(`${where}: https 주소가 아니라 화면에 안 나와요 (${it.url})`); return; }
      const byHost = Object.keys(SHOPS).find(n => SHOPS[n].test(host));
      if (it.shop && !SHOPS[it.shop]) warns.push(`${where}: shop은 에이블리·쿠팡·무신사 중 하나 ("${it.shop}")`);
      else if (it.shop && byHost && it.shop !== byHost) warns.push(`${where}: shop은 "${it.shop}"인데 주소는 ${byHost} 링크예요 (화면에는 주소 기준 ${byHost}로 나옴)`);
      if (it.similar !== undefined && typeof it.similar !== 'boolean') warns.push(`${where}: similar는 true/false로 (따옴표 없이)`);
      if (it.color && COLOR_NAMES.size && !COLOR_NAMES.has(it.color)) warns.push(`${where}: 색 "${it.color}"은 홈 룩 지도 색 표(assets/home.js COLORS)에 없어요`);
    });
  });
  if (empty) notes.push(`주소가 빈 아이템 ${empty}개는 화면에 안 나와요(빈 자리)`);
  for (const [where, t] of texts) {
    if (!t) continue;
    for (const [re, why] of BANNED) if (re.test(t)) warns.push(`${where}: ${why} — "${t.match(re)[0]}"`);
  }
  return { errs, warns, notes };
}

// 미리보기 사진 고르기. 주소 끝 ?v=는 사진 내용이 바뀌면 같이 바뀌어, 새로 퍼 가는 곳이 옛 사진을 붙잡지 않게 한다
function ogOf(look, warns) {
  for (const p of [look.ogImage, `img/ep${look.id}/og.jpg`].filter(Boolean)) {
    if (isUrl(p)) return { url: p, size: null, path: p };
    if (!exists(p)) { if (p === look.ogImage) warns.push(`ogImage 파일이 없어요: ${p}`); continue; }
    const buf = read(p); const size = imageSize(buf);
    if (!/\.(jpe?g|png)$/i.test(p)) warns.push(`미리보기 사진은 JPG·PNG로 (카톡이 읽는 형식): ${p}`);
    if (size && Math.abs(size.w / size.h - 1200 / 630) > 0.15) warns.push(`미리보기 사진 비율이 1200×630과 많이 달라요 (${size.w}×${size.h}) — 잘려 보일 수 있어요`);
    return { url: `${SITE}${p}?v=${hash(buf)}`, size, path: p };
  }
  warns.push(`img/ep${look.id}/og.jpg가 없어 사이트 기본 og.jpg를 미리보기로 써요 → tools/og.html?ep=${look.id} 에서 만들어 올린 뒤 다시 돌려 주세요`);
  const buf = read('og.jpg');
  return { url: `${SITE}og.jpg?v=${hash(buf)}`, size: imageSize(buf), path: 'og.jpg' };
}

function pageHtml(look, og) {
  const url = `${SITE}looks/${look.id}/`;
  const title = `EP.${look.id} ${look.title.trim()}`;
  const desc = `AI 가상인물 윤서의 데일리룩 · ${String(look.summary || look.title).trim()}`;
  const first = look.sets[0].image;
  const meta = [
    '<!-- page-meta -->',
    `<!-- tools/build.mjs가 look.html과 data/looks/${look.id}.json으로 만든 파일입니다. 여기를 직접 고치지 말고 JSON이나 look.html을 고친 뒤 다시 돌려 주세요 -->`,
    `<title>${esc(title)} · 윤서의 룩북</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:site_name" content="윤서의 룩북">',
    '<meta property="og:locale" content="ko_KR">',
    '<meta property="og:type" content="article">',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${esc(og.url)}">`,
    og.size && `<meta property="og:image:width" content="${og.size.w}">`,
    og.size && `<meta property="og:image:height" content="${og.size.h}">`,
    `<meta property="og:image:alt" content="${esc(`EP.${look.id} ${look.title.trim()} — AI로 만든 가상인물 윤서의 룩 사진`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<link rel="preload" href="../../data/looks/${look.id}.json" as="fetch" crossorigin>`,
    !isUrl(first) && `<link rel="preload" href="../../${esc(first)}" as="image" fetchpriority="high">`,
    '<!-- /page-meta -->',
  ].filter(Boolean).join('\n');
  return BASE.replace(META, () => meta)
    .replace('<body class="detail">', `<body class="detail" data-root="../../" data-ep="${look.id}">`);
}

// ── 실행 ──
const ids = readdirSync(file('data/looks')).filter(f => /^\d{3}\.json$/.test(f)).map(f => f.slice(0, 3)).sort();
const done = [];
let bad = 0;
for (const id of ids) {
  let look;
  try { look = JSON.parse(read(`data/looks/${id}.json`).toString()); }
  catch (e) { console.log(`✗ EP.${id}: JSON 문법 오류 — ${e.message}`); bad++; continue; }
  const { errs, warns, notes } = check(look, id);
  if (errs.length) {
    console.log(`✗ EP.${id}: 건너뜀`); errs.forEach(m => console.log(`    - ${m}`)); bad++; continue;
  }
  const og = ogOf(look, warns);
  mkdirSync(file(`looks/${id}`), { recursive: true });
  writeFileSync(file(`looks/${id}/index.html`), pageHtml(look, og));
  done.push(id);
  console.log(`✓ EP.${id} → looks/${id}/index.html  (미리보기 사진 ${og.path}${og.size ? ` ${og.size.w}×${og.size.h}` : ''})`);
  notes.forEach(m => console.log(`    · ${m}`));
  warns.forEach(m => console.log(`    ! ${m}`));
}

// 만든 EP만 목록에 둔다. 하나도 못 만들었으면 목록은 그대로 둔다(홈이 비지 않게)
if (done.length) {
  writeFileSync(file('data/looks/index.json'), JSON.stringify({ ids: done, pages: true }) + '\n');
  console.log(`✓ data/looks/index.json: ${done.join(', ')}`);
}
// JSON이 없거나 건너뛴 EP의 옛 페이지는 지우지 않고 알려만 준다
if (exists('looks')) {
  for (const d of readdirSync(file('looks'))) if (/^\d{3}$/.test(d) && !done.includes(d)) console.log(`! looks/${d}/ — 이번에 안 만든 EP의 옛 페이지예요. 필요 없으면 지워 주세요`);
}
if (bad) { console.log(`\n${bad}개 EP를 건너뛰었어요. 위 내용을 고친 뒤 다시 돌려 주세요.`); process.exit(1); }
