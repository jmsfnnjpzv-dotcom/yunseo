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

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800);
}

async function copyAll(look) {
  const lines = [`윤서의 오늘 룩 EP.${look.id} · ${look.title}`, ''];
  for (const s of look.sets) {
    if (look.sets.length > 1) lines.push(`[${s.name}]`);
    for (const it of s.items) lines.push(`${it.name}${it.color ? ' (' + it.color + ')' : ''} ${it.url}`);
    lines.push('');
  }
  lines.push('(광고) 제휴 링크 포함');
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('링크를 모두 복사했어요'); }
  catch { toast('복사하지 못했어요'); }
}

// 사진 넘기기: 손가락으로 밀기 + 좌우 버튼 + 키보드 화살표 + "1 / 3" 위치 표시
function gallery(imgs, setName, first) {
  const track = h('div', { class: 'track', tabindex: imgs.length > 1 ? '0' : '-1', 'aria-label': `${setName} 사진 ${imgs.length}장` },
    ...imgs.map((m, j) => h('img', first && j === 0
      ? { src: m.image, alt: m.alt, width: 720, height: 960, fetchpriority: 'high' }
      : { src: m.image, alt: m.alt, width: 720, height: 960, loading: 'lazy', decoding: 'async' })));
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
        h('span', { class: 'name' }, it.name, it.color ? h('small', { text: it.color }) : null),
        h('span', { class: 'go', text: '에이블리 ↗' }))));
  }
  return list;
}

const ep = (new URLSearchParams(location.search).get('ep') || '').replace(/\D/g, '').padStart(3, '0');
fetch(`data/looks/${ep}.json`).then(r => { if (!r.ok) throw 0; return r.json(); }).then(look => {
  document.title = `EP.${look.id} ${look.title} · 윤서의 오늘 룩`;
  const main = $('#look'); $('#loading').remove();
  const total = look.sets.reduce((n, s) => n + s.items.length, 0);

  main.append(
    // 에이블리 정책: 제휴 링크가 있는 콘텐츠는 지정 문구를 본문 첫 줄에
    h('p', { class: 'ad-top', text: AD + ' · 사진은 AI로 만든 이미지예요.' }),
    h('header', { class: 'look-head' },
      h('p', { class: 'eyebrow', text: `EP.${look.id} · ${look.season} · ${look.tags.join(' · ')}` }),
      h('h1', { text: look.headline }),
      h('p', { class: 'weather', text: `🌤 ${look.weather.temp} · ${look.weather.note}` }),
      h('p', { class: 'desc', text: look.description }),
      h('div', { class: 'palette' }, ...look.palette.map(([n, c]) => h('span', {}, h('i', { style: `background:${c}` }), n))),
      h('div', { class: 'head-actions' },
        h('button', { type: 'button', class: 'btn ghost small', id: 'copy', text: `링크 ${total}개 전체 복사` }))));

  // 룩마다 사진 바로 아래에 그 룩의 아이템을 둔다 (사진과 목록을 오가지 않게)
  look.sets.forEach((s, i) => {
    const imgs = [{ image: s.image, alt: s.alt }, ...(s.extra || [])];
    const itemsAttrs = { class: 'set-items' };
    if (i === 0) itemsAttrs.id = 'items';
    main.append(h('section', { class: 'set' },
      gallery(imgs, s.name, i === 0),
      h('div', { class: 'set-info' },
        h('h2', { text: s.name }),
        h('p', { class: 'mood', text: s.mood })),
      h('div', itemsAttrs,
        h('p', { class: 'set-count', text: `이 룩의 아이템 ${s.items.length}` }),
        itemList(s))));
  });
  main.append(h('p', { class: 'items-note', text: '사진은 AI 이미지라 실제 상품의 색감·핏과 다를 수 있어요. 옵션과 가격은 판매처에서 확인해 주세요.' }));
  $('#copy').onclick = () => copyAll(look);

  const dock = $('#dock');
  $('#dock-items').textContent = `아이템 ${total}개 보기`;
  const ig = safe(look.instagram);
  if (ig) $('#dock-ig').href = ig; else $('#dock-ig').remove();
  dock.hidden = false;
}).catch(() => { $('#loading').textContent = '이 룩을 찾지 못했어요.'; });
