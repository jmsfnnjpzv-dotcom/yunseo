const $ = s => document.querySelector(s);
const REL = 'sponsored nofollow noopener noreferrer';

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

const ep = (new URLSearchParams(location.search).get('ep') || '').replace(/\D/g, '').padStart(3, '0');
fetch(`data/looks/${ep}.json`).then(r => { if (!r.ok) throw 0; return r.json(); }).then(look => {
  document.title = `EP.${look.id} ${look.title} · 윤서의 오늘 룩`;
  const main = $('#look'); $('#loading').remove();
  const total = look.sets.reduce((n, s) => n + s.items.length, 0);

  main.append(
    h('header', { class: 'look-head' },
      h('p', { class: 'eyebrow', text: `EP.${look.id} · ${look.season} · ${look.tags.join(' · ')}` }),
      h('h1', { text: look.headline }),
      h('p', { class: 'weather', text: `🌤 ${look.weather.temp} · ${look.weather.note}` }),
      h('p', { class: 'desc', text: look.description }),
      h('div', { class: 'palette' }, ...look.palette.map(([n, c]) => h('span', {}, h('i', { style: `background:${c}` }), n)))));

  const itemsWrap = h('section', { class: 'items', id: 'items' },
    h('div', { class: 'items-head' },
      h('h2', { text: `이 룩의 아이템 ${total}` }),
      h('button', { type: 'button', class: 'btn ghost small', id: 'copy' , text: '링크 전체 복사' })),
    h('p', { class: 'items-note', text: '사진은 AI 이미지라 실제 상품의 색감·핏과 다를 수 있어요. 옵션은 판매처에서 확인해 주세요.' }));

  look.sets.forEach((s, i) => {
    const imgs = [{ image: s.image, alt: s.alt }, ...(s.extra || [])];
    const figure = h('div', { class: 'shots' + (imgs.length > 1 ? ' scroll' : '') },
      ...imgs.map((m, j) => h('img', i === 0 && j === 0
        ? { src: m.image, alt: m.alt, width: 720, height: 960, fetchpriority: 'high' }
        : { src: m.image, alt: m.alt, width: 720, height: 960, loading: 'lazy', decoding: 'async' })));
    main.append(h('section', { class: 'set' },
      figure,
      imgs.length > 1 ? h('p', { class: 'swipe', text: `← 밀어서 ${imgs.length}장 보기` }) : null,
      h('div', { class: 'set-info' },
        h('h2', { text: s.name }),
        h('p', { class: 'mood', text: s.mood }))));

    const list = h('ul', { class: 'item-list' });
    for (const it of s.items) {
      const url = safe(it.url); if (!url) continue;
      list.append(h('li', {},
        h('a', { href: url, target: '_blank', rel: REL },
          h('span', { class: 'cat', text: it.cat }),
          h('span', { class: 'name' }, it.name, it.color ? h('small', { text: it.color }) : null),
          h('span', { class: 'go', text: '에이블리 ↗' }))));
    }
    if (look.sets.length > 1) itemsWrap.append(h('h3', { class: 'set-title', text: s.name }));
    itemsWrap.append(list);
  });
  itemsWrap.append(h('p', { class: 'ad small', text: '(광고) 기재된 제휴 링크를 통해 상품을 구매하실 경우, 상품 구매로 발생한 수익의 일부가 작성자에게 분배됩니다.' }));
  main.append(itemsWrap);
  $('#copy').onclick = () => copyAll(look);

  const dock = $('#dock');
  $('#dock-items').textContent = `아이템 ${total}개 보기`;
  const ig = safe(look.instagram);
  if (ig) $('#dock-ig').href = ig; else $('#dock-ig').remove();
  dock.hidden = false;
}).catch(() => { $('#loading').textContent = '이 룩을 찾지 못했어요.'; });
