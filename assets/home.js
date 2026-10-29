// 룩북: data/looks/index.json에 적힌 번호의 EP(001.json, 002.json …)를 불러와 룩(세트)마다 카드 하나로 보여 줍니다.
// 새 룩 추가 = 다음 번호의 JSON 하나 + 이미지 폴더 + `node tools/build.mjs` (README). 위쪽 '룩 지도'(상황·컬러·아이템)는 JSON에서 저절로 만들어집니다.
const SITUATIONS = { 카페: '☕', 데이트: '💐', 주말: '🧺', 산책: '🍂', 저녁약속: '🍷', 하객: '🎀', 여행: '🧳' };
const ITEMS = ['아우터', '가디건', '니트', '블라우스', '셔츠', '티셔츠', '원피스', '스커트', '데님', '팬츠', '슈즈', '가방', '머플러', '주얼리'];
// 아이템의 색 이름 → 지도의 색 묶음: [묶음 이름, 견본색, 이 묶음에 드는 색 이름]. 새 색이 나오면 여기에 더한다
const COLORS = [
  ['화이트·크림', '#f4efe6', ['화이트', '아이보리', '크림']],
  ['베이지', '#cdb08a', ['베이지', '카멜', '샌드']],
  ['브라운', '#6b4a33', ['브라운', '커피', '모카', '초코']],
  ['블루', '#9fb6d0', ['연청', '중청', '진청', '블루', '스카이']],
  ['크랜베리·버건디', '#7d2638', ['크랜베리', '버건디', '와인', '레드']],
  ['블랙·차콜', '#2f2b29', ['블랙', '차콜', '그레이']],
  ['그린', '#2d5a3d', ['그린', '카키', '올리브']],
  ['핑크', '#c98a94', ['핑크', '인디핑크', '로즈']],
];
const familyOf = c => COLORS.find(f => f[2].includes(c))?.[0];
const pad = n => String(n).padStart(3, '0');
const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? 99 : i; };
const iga = w => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '이' : '가'); // 받침 있으면 '이'
const byNewest = (a, b) => b.id.localeCompare(a.id);
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
// 유튜브 영상 번호(11자). 주소를 그대로 넣어도 번호만 뽑는다 (assets/look.js와 같은 규칙)
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

// 없는 번호(404)는 목록의 끝, 그 밖의 실패는 오류로 본다
async function getLook(n) {
  try {
    const r = await fetch(`data/looks/${pad(n)}.json`);
    if (r.status === 404) return { missing: true };
    if (!r.ok) return { error: true };
    return { look: await r.json() };
  } catch { return { error: true }; }
}

// data/looks/index.json: tools/build.mjs가 쓰는 {"ids": [...], "pages": true} 또는 예전 형식 ["001", ...].
// pages가 true면 카드가 EP별 페이지(looks/001/, 공유 미리보기가 그 룩으로 뜸)로, 아니면 look.html?ep=001로 간다.
// 목록이 없으면 예전처럼 001부터 차례로 찾아본다
async function loadLooks() {
  try {
    const r = await fetch('data/looks/index.json', { cache: 'no-cache' });
    if (r.ok) {
      const raw = await r.json();
      const ids = Array.isArray(raw) ? raw : raw.ids;
      if (!Array.isArray(ids)) throw new Error('index');
      const got = await Promise.all(ids.map(id => getLook(Number(id))));
      if (got.some(b => b.error || b.missing)) throw new Error('load');
      return { eps: got.map(b => b.look).sort(byNewest), pages: raw.pages === true };
    }
  } catch (e) { if (e.message === 'load') throw e; }
  const looks = [];
  for (let start = 1; ; start += 6) {
    const batch = await Promise.all([0, 1, 2, 3, 4, 5].map(i => getLook(start + i)));
    if (batch.some(b => b.error)) throw new Error('load');
    looks.push(...batch.filter(b => b.look).map(b => b.look));
    if (batch.some(b => b.missing)) break;
  }
  return { eps: looks.sort(byNewest), pages: false };
}

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v);
  }
  el.append(...kids.filter(Boolean));
  return el;
}

// EP 하나를 룩(세트) 단위로 펼친다. 지도에서 쓰는 열쇠: '상황:카페', '컬러:브라운', '아이템:아우터'
// 아이템은 주소가 있는 것만 센다(주소가 빈 칸 = 아직 안 쓰는 쿠팡·무신사 자리)
function looksOf(ep, pages) {
  const multi = ep.sets.length > 1;
  const page = pages ? `looks/${ep.id}/` : `look.html?ep=${ep.id}`;
  return ep.sets.map((s, i) => {
    const items = (s.items || []).filter(it => isHttps(it.url));
    const keys = new Set((s.tags || ep.tags || []).map(t => '상황:' + t));
    for (const it of items) {
      if (it.cat) keys.add('아이템:' + it.cat);
      const f = familyOf(it.color); if (f) keys.add('컬러:' + f);
    }
    // 쇼츠가 있는 룩은 배지 안에만 ▶ 표시 (따로 누르는 곳을 만들지 않는다. 카드의 사진·이름은 모두 같은 곳으로)
    const short = !!(ytId(s.youtubeId) || (i === 0 && ytId(ep.youtubeId)));
    return {
      ep, s, items, keys, short, id: `${ep.id}-${i + 1}`,
      badge: [multi ? s.name.split('·')[0].trim() : '', short ? '▶︎' : ''].filter(Boolean).join(' '), // 번호·날짜는 화면에 쓰지 않는다
      title: s.name.split('·').pop().trim(), // 상세에서 사진 아래 붙는 룩 이름과 같게
      href: `${page}#set-${i + 1}`, // 사진·이름 → 그 룩의 사진
      itemsHref: `${page}#${i === 0 ? 'items' : `items-${i + 1}`}`, // '아이템 N개 보기' → 그 룩의 아이템 목록
      thumb: i === 0 ? ep.cover : s.image.replace(/(\.\w+)$/, '-s$1'),
    };
  });
}

function card(l, n) {
  const img = h('img', { src: l.thumb, alt: l.s.alt, width: 405, height: 720, loading: n < 4 ? 'eager' : 'lazy', decoding: 'async' });
  img.onerror = () => { img.onerror = null; img.src = l.s.image; }; // 썸네일이 없으면 큰 사진으로
  const match = h('p', { class: 'match', hidden: '' });
  const el = h('article', { class: 'card', style: `--i:${n};view-transition-name:look-${l.id}` },
    h('a', { class: 'card-img', href: l.href, tabindex: '-1', 'aria-hidden': 'true' },
      img, l.badge ? h('span', { class: 'ep', text: l.badge }) : null),
    h('div', { class: 'card-body' },
      l.ep.weather ? h('p', { class: 'meta', text: `🌤 ${l.ep.weather.temp}` }) : null,
      h('h3', {}, h('a', { href: l.href }, l.title, l.short ? h('span', { class: 'sr', text: ' (쇼츠 영상 있음)' }) : null)),
      l.s.mood ? h('p', { class: 'mood', text: l.s.mood }) : null,
      match,
      h('span', { class: 'grow' }),
      l.items.length ? h('a', { class: 'btn solid small', href: l.itemsHref, text: `아이템 ${l.items.length}개 보기` }) : null));
  return { el, match, l };
}

// 룩 지도: 상황·컬러·아이템 묶음마다 칩 한 줄. 룩이 하나도 없거나 모든 룩에 다 있는 칩(눌러도 그대로)은 만들지 않는다
function buildMap(looks, onPick) {
  const has = new Set(looks.flatMap(l => [...l.keys]));
  const count = k => looks.filter(l => l.keys.has(k)).length;
  const useful = (g, v) => count(`${g}:${v}`) < looks.length;
  const vals = (g, order) => [...has].filter(k => k.startsWith(g + ':')).map(k => k.slice(g.length + 1))
    .sort((a, b) => rank(order, a) - rank(order, b));
  const groups = [
    ['상황', vals('상황', Object.keys(SITUATIONS)), v => (SITUATIONS[v] ? h('span', { 'aria-hidden': 'true', text: SITUATIONS[v] }) : null)],
    ['컬러', COLORS.map(c => c[0]).filter(v => has.has('컬러:' + v)), v => h('i', { style: `background:${COLORS.find(c => c[0] === v)[1]}` })],
    ['아이템', vals('아이템', ITEMS), () => null],
  ];
  const map = document.getElementById('map');
  const chips = [];
  map.append(h('p', { class: 'map-title' }, '룩 지도', h('small', { text: '누르면 그런 룩만 모아 보여 줘요' })));
  for (const [g, all, mark] of groups) {
    const list = all.filter(v => useful(g, v));
    if (!list.length) continue;
    map.append(h('div', { class: 'map-group', role: 'group', 'aria-label': g },
      h('h3', { text: g }),
      h('div', { class: 'map-chips' }, ...list.map(v => {
        const b = h('button', { type: 'button', class: 'chip', 'data-key': `${g}:${v}`, 'aria-pressed': 'false' },
          mark(v), v, h('small', { text: String(count(`${g}:${v}`)) }));
        b.onclick = () => onPick(b.dataset.key);
        chips.push(b);
        return b;
      }))));
  }
  // 순서: 최신순(기본)·오래된순. 지도 칩과 같은 모양의 작은 칩 두 개, '모든 룩 N' 줄 오른쪽
  const sorts = ['최신순', '오래된순'].map(v => h('button', { type: 'button', class: 'chip', 'data-sort': v, 'aria-pressed': 'false', text: v }));
  document.getElementById('sort').replaceChildren(...sorts);
  return { chips, sorts };
}

// EP 번호(같으면 날짜)가 큰 것이 최신. 한 EP 안의 LOOK 1·2 순서는 그대로
const epKey = l => `${l.ep.id}|${l.ep.date || ''}`;
function sortCards(cards, order) {
  const dir = order === '오래된순' ? 1 : -1;
  return [...cards].sort((a, b) => {
    const k = epKey(a.l).localeCompare(epKey(b.l));
    return k ? k * dir : a.n - b.n;
  });
}

function render({ eps, pages }) {
  // 쿠팡 링크가 실제로 있는 룩이 있을 때만 footer에 쿠팡 문구를 더한다
  const hasCoupang = eps.some(ep => ep.sets.some(set => (set.items || []).some(it => { try { return /(^|\.)(coupang\.com|coupa\.ng)$/.test(new URL(it.url).hostname); } catch { return false; } })));
  const foot = document.querySelector('.foot');
  if (hasCoupang && foot) foot.append(h('p', { class: 'disclose', text: '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.' }));
  const looks = eps.flatMap(ep => looksOf(ep, pages));
  const cards = looks.map((l, n) => ({ ...card(l, n), n }));
  const grid = document.getElementById('grid');
  let order = sessionStorage.getItem('yunseo-sort') === '오래된순' ? '오래된순' : '최신순';
  const place = () => sortCards(cards, order).forEach((c, i) => { c.el.style.setProperty('--i', i); grid.append(c.el); });
  grid.replaceChildren();
  place();
  grid.classList.add('intro');
  setTimeout(() => grid.classList.remove('intro'), 1200);

  const title = document.getElementById('result-title');
  const count = document.getElementById('count');
  const clear = document.getElementById('clear');
  let current = '';
  const { chips, sorts } = buildMap(looks, k => pick(current === k ? '' : k)); // 같은 칩을 다시 누르면 해제
  const markSort = () => sorts.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === order)));
  markSort();
  for (const b of sorts) b.onclick = () => {
    if (b.dataset.sort === order) return;
    order = b.dataset.sort; sessionStorage.setItem('yunseo-sort', order); markSort();
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (motion && document.startViewTransition) document.startViewTransition(place); else place();
  };

  const pick = (key, animate = true) => {
    const [g, v] = key.split(':');
    const run = () => {
      current = key;
      let shown = 0;
      for (const c of cards) {
        const on = !key || c.l.keys.has(key);
        c.el.hidden = !on; if (on) shown++;
        // 컬러·아이템으로 고르면 그 룩에서 해당하는 아이템 이름을 카드에 보여 준다
        const hit = on && g !== '상황' && key ? c.l.items.filter(it => (g === '컬러' ? familyOf(it.color) === v : it.cat === v)) : [];
        c.match.replaceChildren(...(hit.length ? [h('b', { text: v }), hit.map(it => it.name).join(', ')] : []));
        c.match.hidden = !hit.length;
      }
      for (const b of chips) {
        b.setAttribute('aria-pressed', String(b.dataset.key === key));
        if (b.dataset.key !== key) continue;
        // 폰에서 칩 줄이 옆으로 넘어가 있으면 고른 칩이 보이게 가로로만 민다
        const row = b.parentElement;
        row.scrollLeft += b.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - b.offsetWidth) / 2;
      }
      title.textContent = !key ? '모든 룩' : g === '상황' ? `${v} 룩` : `${v}${iga(v)} 들어간 룩`;
      count.textContent = shown;
      clear.hidden = !key;
    };
    const motion = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (motion && document.startViewTransition) document.startViewTransition(run);
    else {
      run();
      if (motion) { grid.classList.remove('flash'); void grid.offsetWidth; grid.classList.add('flash'); }
    }
    history.replaceState(null, '', key ? `#${encodeURIComponent(key)}` : location.pathname + location.search);
  };
  clear.onclick = () => pick('');
  const start = decodeURIComponent(location.hash.slice(1));
  pick(chips.some(b => b.dataset.key === start) ? start : '', false);
}

function showError() {
  const retry = h('button', { type: 'button', class: 'btn ghost small', text: '다시 불러오기' });
  retry.onclick = () => location.reload();
  document.getElementById('grid').replaceChildren(h('div', { class: 'load-error' },
    h('p', { text: '룩을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.' }), retry));
}

loadLooks().then(render).catch(showError);
