// 상세(EP) 페이지. 예전 주소 look.html?ep=001과, tools/build.mjs가 만든 EP별 페이지 looks/001/ 이 같이 씁니다.
// EP별 페이지는 <body data-root="../../" data-ep="001">: JSON의 상대 경로(img/… data/…) 앞에 root를 붙이고, EP 번호는 주소 대신 여기서 읽는다
const $ = s => document.querySelector(s);
const REL = 'sponsored nofollow noopener noreferrer';
const YT_CHANNEL = 'https://www.youtube.com/@ootw.yunseo';
// 고지 문구. AD는 에이블리 광고 문구(본문 첫 줄), 쿠팡 문구는 쿠팡 링크가 실제로 있을 때만, 가상인물 문구는 늘
const AD = '(광고) 기재된 제휴 링크를 통해 상품을 구매하실 경우, 상품 구매로 발생한 수익의 일부가 작성자에게 분배됩니다.';
const AD_COUPANG = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
const AI_NOTE = '윤서는 AI로 만든 가상인물이에요.';
const PHOTO_NOTE = '사진은 AI 이미지라 색·디테일·핏이 다를 수 있어요.';
// 상점 이름: 링크 주소로 먼저 알아보고, 모르는 주소면 JSON의 shop 칸(에이블리·쿠팡·무신사)을 쓴다
const SHOPS = [['에이블리', /(^|\.)a-bly\.com$/], ['쿠팡', /(^|\.)(coupang\.com|coupa\.ng)$/], ['무신사', /(^|\.)musinsa\.com$/]];

const page = document.body.dataset;
const ROOT = page.root || '';
const HOME = ROOT || './';
const at = p => (!p || /^([a-z][a-z\d+.-]*:|\/)/i.test(p) ? p : ROOT + p);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v);
  }
  el.append(...kids.filter(Boolean));
  return el;
}
const safe = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
const fmtDate = d => (d ? d.slice(5).replace('-', '.') : '');
// "LOOK 1 · 크림 × 브라운" → "LOOK 1". 이름에 '·'가 없으면 순서로 붙인다
const lookNo = (s, i) => (s.name.includes('·') ? s.name.split('·')[0].trim() : `LOOK ${i + 1}`);
// 화면에 나오는 아이템 = 주소가 있는 것만. 주소가 빈 칸(아직 안 쓰는 쿠팡·무신사 자리)은 보이지도, 세지도 않는다
const itemsOf = s => (s.items || []).filter(it => safe(it.url));
const shopOf = it => {
  let host = '';
  try { host = new URL(it.url).hostname; } catch { /* 주소가 이상하면 shop 칸으로 */ }
  return SHOPS.find(([, re]) => re.test(host))?.[0] || (SHOPS.some(([n]) => n === it.shop) ? it.shop : '');
};
// 유튜브 영상 번호(11자). 주소(youtube.com/shorts/…, youtu.be/…, watch?v=…)를 그대로 넣어도 번호만 뽑는다
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
// 쇼츠·움직이는 사진은 룩(sets[])마다. EP 맨 위에 적은 값은 첫 룩에 붙는다(룩이 하나인 EP에서 편하게)
const shortOf = (look, s, i) => ytId(s.youtubeId) || (i === 0 ? ytId(look.youtubeId) : '');
const loopOf = (look, s, i) => s.loopMp4 || (i === 0 ? look.loopMp4 : '') || '';

function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms);
}

// 복사한 글(다른 곳에 붙여 넣는 글): 첫 줄에 광고 문구(쿠팡 링크가 있으면 쿠팡 문구도)와 가상인물 문구, 그다음 룩 이름·이 페이지 주소·아이템 링크
async function copyAll(look, pageUrl) {
  const all = look.sets.flatMap(itemsOf);
  const lines = [AD];
  if (all.some(it => shopOf(it) === '쿠팡')) lines.push(AD_COUPANG);
  lines.push(AI_NOTE, '', `윤서의 룩북 EP.${look.id} · ${look.title}`, pageUrl, '');
  for (const s of look.sets) {
    const items = itemsOf(s);
    if (!items.length) continue;
    if (look.sets.length > 1) lines.push(`[${s.name}]`);
    for (const it of items) lines.push(`${it.name}${it.color ? ` (${it.color})` : ''}${it.similar ? ' [비슷한 상품]' : ''} ${safe(it.url)}`);
    lines.push('');
  }
  try { await navigator.clipboard.writeText(lines.join('\n').trim()); toast('아이템 링크를 모두 복사했어요'); }
  catch { toast('복사하지 못했어요. 아이템을 길게 눌러 링크를 하나씩 복사해 주세요', 3200); }
}

// 움직이는 사진(loopMp4): 소리 없이 반복, 화면에 반쯤 보일 때만 재생. 못 틀면(파일 없음·형식) 사진으로 바꾼다
const seen = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting && !v.closest('.is-short')) v.play().catch(() => {}); else v.pause();
  }
}, { threshold: 0.5 }) : null;
function photo(m, eager) {
  return h('img', eager
    ? { src: at(m.image), alt: m.alt, width: 720, height: 1280, fetchpriority: 'high' }
    : { src: at(m.image), alt: m.alt, width: 720, height: 1280, loading: 'lazy', decoding: 'async' });
}
function loopVideo(src, m, eager) {
  const v = h('video', { src: at(src), poster: at(m.image), muted: '', loop: '', playsinline: '', preload: 'none',
    width: 720, height: 1280, 'aria-label': m.alt });
  v.muted = true; // iOS는 속성과 함께 값도 있어야 소리 없는 자동재생을 허용한다
  v.addEventListener('error', () => { seen?.unobserve(v); v.replaceWith(photo(m, eager)); }, { once: true });
  if (seen) seen.observe(v); else v.autoplay = true;
  return v;
}

// 쇼츠: 사진 왼쪽 아래 '▶ 쇼츠' 알약을 누르면 같은 9:16 칸이 유튜브 플레이어(youtube-nocookie)로 바뀐다.
// 누르는 순간 플레이어를 띄워 자동재생을 시도하고, 앱 안 브라우저가 막으면 플레이어의 재생 버튼 한 번만 누르면 된다.
// 플레이어 위에는 아무것도 덮지 않고, 칸 아래 줄에 '가상인물'을 늘 둔다
function shorts(box, stage, id, setName) {
  const pill = h('button', { type: 'button', class: 'pill', 'aria-label': `${setName} 쇼츠 영상 보기`, text: '쇼츠' });
  const frame = h('div', { class: 'player-frame' }, h('span', { text: '쇼츠 불러오는 중…' }));
  const back = h('button', { type: 'button', text: '사진 보기' });
  const out = h('a', { href: `https://www.youtube.com/shorts/${id}`, target: '_blank', rel: 'noopener', text: '유튜브에서 보기 ↗' });
  stage.append(pill, h('div', { class: 'player' }, frame));
  box.append(h('div', { class: 'vbar' },
    h('span', { class: 'tag', text: '가상인물' }),
    h('span', { class: 'vbar-links' }, back, h('i', { 'aria-hidden': 'true', text: '·' }), out)));
  let iframe = null;
  pill.onclick = e => {
    iframe = h('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
      title: `${setName} 쇼츠 영상 (유튜브)`,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin', // 리퍼러가 빠지면 유튜브가 재생을 막는다(오류 153)
    });
    frame.append(iframe);
    box.classList.add('is-short');
    box.querySelectorAll('video').forEach(v => v.pause());
    if (e.detail === 0) iframe.focus({ preventScroll: true }); // 키보드로 열었으면 바로 스페이스로 재생할 수 있게
  };
  back.onclick = e => {
    iframe?.remove(); iframe = null;
    box.classList.remove('is-short');
    box.querySelectorAll('video').forEach(v => v.play().catch(() => {}));
    if (e.detail === 0) pill.focus({ preventScroll: true });
  };
}

// 사진 넘기기: 손가락으로 밀기 + 좌우 버튼 + 키보드 화살표 + "1 / 3" 위치 표시. 사진마다 '가상인물' 배지
// 움직이는 사진은 '동작 줄이기'나 '데이터 절약'을 켠 사람에게는 틀지 않고 사진으로 둔다
function gallery({ imgs, setName, first, short, loop }) {
  const moving = loop && !reduceMotion() && !navigator.connection?.saveData;
  const track = h('div', { class: 'track', tabindex: imgs.length > 1 ? '0' : '-1', 'aria-label': `${setName} 사진 ${imgs.length}장` },
    ...imgs.map((m, j) => h('figure', { class: 'shot' },
      j === 0 && moving ? loopVideo(loop, m, first) : photo(m, first && j === 0),
      h('span', { class: 'ai-badge', 'aria-hidden': 'true', text: '가상인물' }))));
  const stage = h('div', { class: 'stage' }, track);
  const box = h('div', { class: 'shots' + (imgs.length > 1 ? ' many' : '') }, stage);
  if (imgs.length > 1) {
    const prev = h('button', { type: 'button', class: 'nav prev', 'aria-label': '이전 사진', text: '‹' });
    const next = h('button', { type: 'button', class: 'nav next', 'aria-label': '다음 사진', text: '›' });
    const count = h('span', { class: 'count', 'aria-live': 'polite' });
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, ...imgs.map(() => h('i')));
    box.append(prev, next, h('div', { class: 'gbar' }, dots, count));

    const kids = [...track.children];
    const index = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let i = 0;
      kids.forEach((k, n) => { if (k.offsetLeft <= mid) i = n; });
      return i;
    };
    const goTo = i => {
      const k = kids[Math.max(0, Math.min(kids.length - 1, i))];
      track.scrollTo({ left: k.offsetLeft - (track.clientWidth - k.clientWidth) / 2, behavior: 'smooth' });
    };
    const update = () => {
      const i = index();
      count.textContent = `${i + 1} / ${kids.length}`;
      prev.disabled = i === 0;
      next.disabled = i === kids.length - 1;
      [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i));
    };
    prev.onclick = () => goTo(index() - 1);
    next.onclick = () => goTo(index() + 1);
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { goTo(index() + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { goTo(index() - 1); e.preventDefault(); }
    });
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', update);
    requestAnimationFrame(update);
  }
  if (short) shorts(box, stage, short, setName);
  return box;
}

// 인스타 게시물 카드: 작은 사진(누르면 그 게시물로) + 짧은 안내. 릴스는 재생 표시
function igCard({ url, thumb, alt, label, sub, reel }) {
  return h('a', { class: 'ig-card' + (reel ? ' reel' : ''), href: url, target: '_blank', rel: 'noopener' },
    h('span', { class: 'ig-thumb' },
      h('img', { src: at(thumb), alt, width: 192, height: 256, loading: 'lazy', decoding: 'async' }),
      reel ? h('span', { class: 'play', 'aria-hidden': 'true' }) : null),
    h('span', { class: 'ig-text' },
      h('b', { text: label }),
      h('small', { text: sub })),
    h('span', { class: 'ig-go', 'aria-hidden': 'true', text: '↗' }));
}
// 유튜브 채널 카드: 사진 대신 재생 표시만 둔다 (그 EP의 영상으로 오해하지 않게)
const ytCard = () => h('a', { class: 'ig-card', href: YT_CHANNEL, target: '_blank', rel: 'noopener' },
  h('span', { class: 'ig-thumb yt-thumb', 'aria-hidden': 'true' }),
  h('span', { class: 'ig-text' }, h('b', { text: '유튜브 쇼츠' }), h('small', { text: '움직이는 룩 영상 · @ootw.yunseo' })),
  h('span', { class: 'ig-go', 'aria-hidden': 'true', text: '↗' }));
// 썸네일 칸이 없으면 그 룩의 홈 썸네일(-s)을 쓴다
const thumbOf = img => img.replace(/(\.\w+)$/, '-s$1');

// 아이템: 오른쪽은 상점 이름(에이블리 ↗ / 쿠팡 ↗ / 무신사 ↗), 사진과 다른 상품이면 갈색 '비슷한 상품'
function itemList(items) {
  return h('ul', { class: 'item-list' }, ...items.map(it => {
    const diff = [it.similar === true && '비슷한 상품', it.note].filter(Boolean).join(' · ');
    return h('li', {},
      h('a', { href: safe(it.url), target: '_blank', rel: REL },
        h('span', { class: 'cat', text: it.cat }),
        h('span', { class: 'name' }, it.name,
          it.color ? h('small', { text: it.color }) : null,
          diff ? h('small', { class: 'diff', text: diff }) : null),
        h('span', { class: 'go', text: `${shopOf(it) || '보러 가기'} ↗` })));
  }));
}

// 룩북(홈)에서 들어왔으면 '← 룩북'·'다른 룩 보러 가기'는 뒤로 가기로: 고른 칩과 스크롤 위치가 그대로 남는다
const ref = document.referrer ? new URL(document.referrer) : null;
const isLookPath = p => /\/look\.html$|\/looks\/\d+\/(index\.html)?$/.test(p);
const fromBook = ref && ref.origin === location.origin && !isLookPath(ref.pathname) && history.length > 1; // 새 탭으로 열었으면 돌아갈 기록이 없으니 그냥 링크로
const toBook = a => { if (fromBook) a.onclick = e => { e.preventDefault(); history.back(); }; };
toBook($('.back'));

// 같은 페이지 안 이동(룩 바로가기·하단 버튼)은 뒤로 가기 기록을 쌓지 않는다
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  const t = a && document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  t.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
  history.replaceState(null, '', a.getAttribute('href'));
});

function render(look) {
  document.title = `EP.${look.id} ${look.title} · 윤서의 룩북`;
  const main = $('#look'); $('#loading').remove();
  const sets = look.sets.map((s, i) => ({ s, i, items: itemsOf(s), short: shortOf(look, s, i), loop: loopOf(look, s, i) }));
  const total = sets.reduce((n, x) => n + x.items.length, 0);
  const coupang = sets.some(x => x.items.some(it => shopOf(it) === '쿠팡'));
  const multi = look.sets.length > 1;
  const pageUrl = $('link[rel="canonical"]')?.href || location.href.split('#')[0];

  // 머리: EP 번호 → 큰 제목 → 날씨 줄 → 고지 상자(3줄 안쪽) → 룩 바로가기. 첫 화면은 최대한 사진에 양보한다
  // (날씨·색·태그·글 같은 칸은 JSON에 없어도 그 줄만 빠지고 화면은 그대로 나온다)
  const w = look.weather;
  main.append(
    h('header', { class: 'look-head' },
      h('p', { class: 'eyebrow', text: [`EP.${look.id}`, fmtDate(look.date)].filter(Boolean).join(' · ') }),
      h('h1', { text: look.headline || look.title }),
      w ? h('p', { class: 'weather', text: ['🌤 ' + w.temp, w.note].filter(Boolean).join(' · ') }) : null,
      h('div', { class: 'notice', role: 'note', 'aria-label': '광고·가상인물 안내' },
        total ? h('p', { text: AD }) : null,
        coupang ? h('p', { text: AD_COUPANG }) : null,
        h('p', { class: 'ai', text: AI_NOTE })),
      multi ? h('nav', { class: 'toc', 'aria-label': '룩 바로가기' },
        ...look.sets.map((s, i) => h('a', { href: `#set-${i + 1}`, text: s.name }))) : null));

  // 룩마다 사진(쇼츠 알약) → 이름 → 그 룩의 아이템(머리에 '광고 · 구매하면 수수료', 끝에 AI 사진 안내)
  const boxes = sets.map(({ s, i, items, short, loop }) => {
    const imgs = [{ image: s.image, alt: s.alt }, ...(s.extra || [])];
    const box = h('div', { class: 'set-items', id: i === 0 ? 'items' : `items-${i + 1}` },
      h('div', { class: 'set-head' },
        h('p', { class: 'set-count', text: multi ? `${lookNo(s, i)} 아이템 ${items.length}` : `아이템 ${items.length}` }),
        h('span', { class: 'ad-tag', text: '광고 · 구매하면 수수료' })),
      items.some(it => shopOf(it) === '쿠팡') ? h('p', { class: 'items-ad', text: AD_COUPANG }) : null,
      itemList(items),
      h('p', { class: 'items-note', text: PHOTO_NOTE }));
    const sec = h('section', { class: 'set', id: `set-${i + 1}` },
      gallery({ imgs, setName: s.name, first: i === 0, short, loop }),
      h('div', { class: 'set-side' },
        h('div', { class: 'set-info' }, h('h2', { text: s.name }), s.mood ? h('p', { class: 'mood', text: s.mood }) : null),
        safe(s.reel) ? igCard({ url: safe(s.reel), thumb: s.reelThumb || thumbOf(s.image), alt: `${s.name} 릴스 영상 표지`,
          label: '릴스로 보기', sub: '이 룩이 움직이는 영상 · 인스타그램', reel: true }) : null,
        box));
    main.append(sec);
    return { sec, items: box, s, n: items.length };
  });

  // 끝: 윤서의 메모(게시물 글·색·상황·인스타·유튜브) → 링크 복사 → 다른 룩
  const ig = safe(look.instagram);
  const more = h('a', { class: 'btn solid', href: HOME, text: '다른 룩 보러 가기' });
  toBook(more);
  const end = h('section', { class: 'end' },
    total ? h('button', { type: 'button', class: 'btn ghost', id: 'copy', text: `아이템 링크 ${total}개 전체 복사` }) : null,
    more);
  main.append(h('div', { class: 'outro' },
    h('section', { class: 'memo' },
      h('h2', { text: '윤서의 메모' }),
      look.description ? h('p', { class: 'desc', text: look.description }) : null,
      look.palette?.length ? h('div', { class: 'palette' }, ...look.palette.map(([n, c]) => h('span', {}, h('i', { style: `background:${c}` }), n))) : null,
      // 상황 태그를 누르면 룩북에서 그 상황의 룩만 모아 본다
      look.tags?.length ? h('p', { class: 'tags' }, ...look.tags.map(t => h('a', { href: `${HOME}#${encodeURIComponent('상황:' + t)}`, text: '#' + t }))) : null,
      ig ? igCard({ url: ig, thumb: look.instagramThumb || look.cover, alt: `EP.${look.id} 인스타 게시물 첫 사진`,
        label: '인스타에서 보기', sub: '게시물에 댓글 남기기 · @ootw.yunseo' }) : null,
      ytCard()),
    end));
  const copy = $('#copy');
  if (copy) copy.onclick = () => copyAll(look, pageUrl);

  // 하단 버튼: 지금 보고 있는 룩의 아이템으로 간다. 끝 구역이 보이면 내려서 끝의 버튼과 겹치지 않게
  const dock = $('#dock'); const dockBtn = $('#dock-items');
  if (!total) return;
  const setDock = i => {
    const b = boxes[i];
    dockBtn.textContent = multi ? `${lookNo(b.s, i)} 아이템 ${b.n}개 보기` : `아이템 ${total}개 보기`;
    dockBtn.href = `#${b.items.id}`;
  };
  // 화면 가운데보다 위에서 시작한 룩 중 마지막 것 = 지금 보고 있는 룩 (빨리 내려도 맞게)
  const sync = () => {
    let i = 0;
    boxes.forEach((b, n) => { if (b.sec.getBoundingClientRect().top <= innerHeight / 2) i = n; });
    setDock(i);
    // 그 룩의 아이템 목록이 이미 보이면(눌러도 그 자리) 또는 끝 구역이 보이면 버튼을 내린다
    const r = boxes[i].items.getBoundingClientRect();
    const away = end.getBoundingClientRect().top < innerHeight - 40 || (r.top < innerHeight - 90 && r.bottom > 90);
    dock.classList.toggle('away', away); dock.inert = away;
  };
  let raf = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  dock.hidden = false;

  // 홈 카드에서 룩을 골라 들어오면(#set-2, #items-2 등) 그린 뒤에 그 자리로 이동
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  sync();
}

const getJSON = (u, opt) => fetch(u, opt).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
const ep = (page.ep || new URLSearchParams(location.search).get('ep') || '').replace(/\D/g, '').padStart(3, '0');
// 예전 주소(look.html?ep=001)로 들어왔고 EP별 페이지가 만들어져 있으면(index.json의 pages) 그리로 옮긴다:
// 주소창 주소를 그대로 복사해 공유해도 그 룩의 미리보기가 뜨게
const moved = page.ep ? Promise.resolve(false)
  : getJSON('data/looks/index.json', { cache: 'no-cache' }).then(x => !Array.isArray(x) && x.pages === true && x.ids?.includes(ep)).catch(() => false);
Promise.all([getJSON(at(`data/looks/${ep}.json`)), moved]).then(([look, go]) => {
  if (go) { location.replace(`looks/${ep}/${location.hash}`); return; }
  render(look);
}).catch(() => { $('#loading').textContent = '이 룩을 찾지 못했어요. 위의 ‘← 룩북’을 눌러 다시 골라 주세요.'; });
