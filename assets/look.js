const $ = s => document.querySelector(s);
const REL = 'sponsored nofollow noopener noreferrer';
const AD = '(광고) 기재된 제휴 링크를 통해 상품을 구매하실 경우, 상품 구매로 발생한 수익의 일부가 작성자에게 분배됩니다.';

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

function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms);
}

// 복사한 글도 첫 줄에 광고 표시가 오게 한다 (에이블리 정책: 본문 첫 줄)
async function copyAll(look) {
  const lines = [AD, '', `윤서의 룩북 EP.${look.id} · ${look.title}`, ''];
  for (const s of look.sets) {
    if (look.sets.length > 1) lines.push(`[${s.name}]`);
    for (const it of s.items) lines.push(`${it.name}${it.color ? ' (' + it.color + ')' : ''} ${it.url}`);
    lines.push('');
  }
  try { await navigator.clipboard.writeText(lines.join('\n').trim()); toast('아이템 링크를 모두 복사했어요'); }
  catch { toast('복사하지 못했어요. 아이템을 길게 눌러 링크를 하나씩 복사해 주세요', 3200); }
}

// 사진 넘기기: 손가락으로 밀기 + 좌우 버튼 + 키보드 화살표 + "1 / 3" 위치 표시. 사진마다 'AI 이미지' 표시
function gallery(imgs, setName, first) {
  const track = h('div', { class: 'track', tabindex: imgs.length > 1 ? '0' : '-1', 'aria-label': `${setName} 사진 ${imgs.length}장` },
    ...imgs.map((m, j) => h('figure', { class: 'shot' },
      h('img', first && j === 0
        ? { src: m.image, alt: m.alt, width: 720, height: 960, fetchpriority: 'high' }
        : { src: m.image, alt: m.alt, width: 720, height: 960, loading: 'lazy', decoding: 'async' }),
      h('span', { class: 'ai-tag', text: 'AI 이미지' }))));
  const box = h('div', { class: 'shots' + (imgs.length > 1 ? ' many' : '') }, track);
  if (imgs.length < 2) return box;

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
  return box;
}

function itemList(s) {
  const list = h('ul', { class: 'item-list' });
  for (const it of s.items) {
    const url = safe(it.url); if (!url) continue;
    list.append(h('li', {},
      h('a', { href: url, target: '_blank', rel: REL },
        h('span', { class: 'cat', text: it.cat }),
        h('span', { class: 'name' }, it.name,
          it.color ? h('small', { text: it.color }) : null,
          it.note ? h('small', { class: 'diff', text: it.note }) : null),
        h('span', { class: 'go', text: '에이블리 ↗' }))));
  }
  return list;
}

// 룩북(홈)에서 들어왔으면 '← 룩북'·'다른 룩 보러 가기'는 뒤로 가기로: 고른 칩과 스크롤 위치가 그대로 남는다
const ref = document.referrer ? new URL(document.referrer) : null;
const fromBook = ref && ref.origin === location.origin && !ref.pathname.endsWith('look.html');
const toBook = a => { if (fromBook) a.onclick = e => { e.preventDefault(); history.back(); }; };
toBook($('.back'));

// 같은 페이지 안 이동(룩 바로가기·하단 버튼)은 뒤로 가기 기록을 쌓지 않는다
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  const t = a && document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', a.getAttribute('href'));
});

const ep = (new URLSearchParams(location.search).get('ep') || '').replace(/\D/g, '').padStart(3, '0');
fetch(`data/looks/${ep}.json`).then(r => { if (!r.ok) throw 0; return r.json(); }).then(look => {
  document.title = `EP.${look.id} ${look.title} · 윤서의 룩북`;
  const main = $('#look'); $('#loading').remove();
  const total = look.sets.reduce((n, s) => n + s.items.length, 0);
  const multi = look.sets.length > 1;

  // 본문 첫 줄은 에이블리가 정한 광고 문구 그대로. 머리는 짧게 두고 첫 화면은 사진에 양보한다
  // (날씨·색·태그·글 같은 칸은 JSON에 없어도 그 줄만 빠지고 화면은 그대로 나온다)
  const w = look.weather;
  main.append(
    h('p', { class: 'ad-top', text: AD }),
    h('header', { class: 'look-head' },
      h('p', { class: 'eyebrow', text: [`EP.${look.id}`, fmtDate(look.date)].filter(Boolean).join(' · ') }),
      h('h1', { text: look.headline || look.title }),
      w ? h('p', { class: 'weather', text: ['🌤 ' + w.temp, w.note].filter(Boolean).join(' · ') }) : null,
      multi ? h('nav', { class: 'toc', 'aria-label': '룩 바로가기' },
        ...look.sets.map((s, i) => h('a', { href: `#set-${i + 1}`, text: s.name }))) : null));

  // 룩마다 사진 → 이름 → 그 룩의 아이템. 목록 머리에도 광고·AI 표시를 둬서 바로 내려와도 보이게
  const boxes = look.sets.map((s, i) => {
    const imgs = [{ image: s.image, alt: s.alt }, ...(s.extra || [])];
    const items = h('div', { class: 'set-items', id: i === 0 ? 'items' : `items-${i + 1}` },
      h('div', { class: 'set-head' },
        h('p', { class: 'set-count', text: multi ? `${lookNo(s, i)} 아이템 ${s.items.length}` : `아이템 ${s.items.length}` }),
        h('span', { class: 'ad-tag', text: '(광고) 제휴 링크' })),
      h('p', { class: 'items-warn', text: '사진은 AI 이미지라 실물과 다를 수 있어요.' }),
      itemList(s));
    const sec = h('section', { class: 'set', id: `set-${i + 1}` },
      gallery(imgs, s.name, i === 0),
      h('div', { class: 'set-side' },
        h('div', { class: 'set-info' }, h('h2', { text: s.name }), s.mood ? h('p', { class: 'mood', text: s.mood }) : null),
        items));
    main.append(sec);
    return { sec, items, s };
  });

  // 끝: 윤서의 메모(게시물 글·색·상황) → 링크 복사 → 다른 룩
  const ig = safe(look.instagram);
  const more = h('a', { class: 'btn solid', href: './', text: '다른 룩 보러 가기' });
  toBook(more);
  const end = h('section', { class: 'end' },
    h('button', { type: 'button', class: 'btn ghost', id: 'copy', text: `아이템 링크 ${total}개 전체 복사` }),
    h('p', { class: 'end-note', text: '메모나 친구에게 보내기 좋게 링크를 한 번에 복사해요. 복사한 글 첫 줄에 광고 표시가 들어가요.' }),
    more);
  main.append(h('div', { class: 'outro' },
    h('section', { class: 'memo' },
      h('h2', { text: '윤서의 메모' }),
      look.description ? h('p', { class: 'desc', text: look.description }) : null,
      look.palette?.length ? h('div', { class: 'palette' }, ...look.palette.map(([n, c]) => h('span', {}, h('i', { style: `background:${c}` }), n))) : null,
      // 상황 태그를 누르면 룩북에서 그 상황의 룩만 모아 본다
      look.tags?.length ? h('p', { class: 'tags' }, ...look.tags.map(t => h('a', { href: `./#${encodeURIComponent('상황:' + t)}`, text: '#' + t }))) : null,
      ig ? h('a', { class: 'ig-link', href: ig, target: '_blank', rel: 'noopener', text: '인스타 게시물에서 댓글 남기기 ↗' }) : null),
    end));
  $('#copy').onclick = () => copyAll(look);

  // 하단 버튼: 지금 보고 있는 룩의 아이템으로 간다. 끝 구역이 보이면 내려서 끝의 버튼과 겹치지 않게
  const dock = $('#dock'); const dockBtn = $('#dock-items');
  const setDock = i => {
    const b = boxes[i];
    dockBtn.textContent = multi ? `${lookNo(b.s, i)} 아이템 ${b.s.items.length}개 보기` : `아이템 ${total}개 보기`;
    dockBtn.href = `#${b.items.id}`;
  };
  // 화면 가운데보다 위에서 시작한 룩 중 마지막 것 = 지금 보고 있는 룩 (빨리 내려도 맞게)
  const sync = () => {
    let i = 0;
    boxes.forEach((b, n) => { if (b.sec.getBoundingClientRect().top <= innerHeight / 2) i = n; });
    setDock(i);
    const away = end.getBoundingClientRect().top < innerHeight - 40;
    dock.classList.toggle('away', away); dock.inert = away;
  };
  let raf = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  dock.hidden = false;

  // 홈 카드에서 룩을 골라 들어오면(#set-2, #items-2 등) 그린 뒤에 그 자리로 이동
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  sync();
}).catch(() => { $('#loading').textContent = '이 룩을 찾지 못했어요. 위의 ‘← 룩북’을 눌러 다시 골라 주세요.'; });
