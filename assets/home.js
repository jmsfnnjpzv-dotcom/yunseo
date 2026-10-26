// 룩 목록: data/looks/001.json, 002.json ... 을 순서대로 찾아 불러옵니다.
// 새 룩 추가 = 다음 번호의 JSON 하나 + 이미지 폴더만 추가하면 끝.
const SITUATIONS = ['카페', '데이트', '주말', '산책', '하객', '저녁약속', '여행'];
const pad = n => String(n).padStart(3, '0');

async function loadLooks() {
  const looks = [];
  for (let start = 1; ; start += 6) {
    const batch = await Promise.all([0, 1, 2, 3, 4, 5].map(i =>
      fetch(`data/looks/${pad(start + i)}.json`).then(r => r.ok ? r.json() : null).catch(() => null)));
    const ok = batch.filter(Boolean);
    looks.push(...ok);
    if (ok.length < batch.length) break;
  }
  return looks.sort((a, b) => b.id.localeCompare(a.id));
}

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v);
  }
  el.append(...kids.filter(Boolean));
  return el;
}

function card(look, eager) {
  const items = look.sets.reduce((n, s) => n + s.items.length, 0);
  const href = `look.html?ep=${look.id}`;
  const img = h('img', { src: look.cover, alt: look.title, width: 480, height: 640, loading: eager ? 'eager' : 'lazy', decoding: 'async' });
  return h('article', { class: 'card', 'data-tags': look.tags.join(',') },
    h('a', { class: 'card-img', href },
      img,
      h('span', { class: 'ep', text: `EP.${look.id}` }),
      look.sets.length > 1 ? h('span', { class: 'multi', text: `${look.sets.length} LOOKS` }) : null),
    h('div', { class: 'card-body' },
      h('p', { class: 'weather', text: `🌤 ${look.weather.temp} · ${look.weather.note}` }),
      h('h3', {}, h('a', { href, text: look.title })),
      h('p', { class: 'summary', text: look.summary }),
      h('div', { class: 'tags' }, ...look.tags.map(t => h('span', { text: '#' + t }))),
      h('a', { class: 'btn solid small', href, text: `아이템 ${items}개 보기 →` })));
}

loadLooks().then(looks => {
  const grid = document.getElementById('grid');
  document.getElementById('count').textContent = looks.length;
  looks.forEach((l, i) => grid.append(card(l, i < 2)));

  const counts = Object.fromEntries(SITUATIONS.map(s => [s, looks.filter(l => l.tags.includes(s)).length]));
  const chips = document.getElementById('chips');
  const all = ['전체', ...SITUATIONS];
  let current = '전체';
  const apply = () => {
    let shown = 0;
    for (const c of grid.children) {
      const on = current === '전체' || c.dataset.tags.split(',').includes(current);
      c.hidden = !on; if (on) shown++;
    }
    document.getElementById('empty').hidden = shown > 0;
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.tag === current));
  };
  for (const tag of all) {
    const n = tag === '전체' ? looks.length : counts[tag];
    if (!n && tag !== '전체') continue; // 아직 룩이 없는 상황은 칩을 숨긴다 (눌러도 빈 화면만 나와서)
    const b = h('button', { type: 'button', class: n ? 'chip' : 'chip dim', 'data-tag': tag }, tag, h('small', { text: String(n) }));
    b.onclick = () => { current = tag; apply(); };
    chips.append(b);
  }
  apply();
}).catch(() => { document.getElementById('grid').textContent = '룩을 불러오지 못했어요. 새로고침해 주세요.'; });
