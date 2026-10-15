'use strict';
// AI 용어사전 - 화면 전체를 주소(?q= ?tab= ?entry= ?tag= ?lv= ?view=)에 따라 그린다.
const T = window.TERMS;
const LV = ['일상', '실무', '전문'];
const LVNAME = { 일상: '일상 용어', 실무: '실무 용어', 전문: '전문 용어' };
const HIDE = new Set([...LV, '기초']); // 난이도와 겹치는 태그는 주제로 안 보임
const TABS = [['all', '전체'], ['word', '단어'], ['idiom', '관용구'], ['def', '뜻풀이'], ['ex', '예문'], ['spell', '맞춤법/표기법']];
const PALETTE = [['#e8f8ef', '#00a347'], ['#eef3ff', '#2f6be0'], ['#fff3e6', '#e07000'], ['#f5eeff', '#8a44d8'], ['#ffeef0', '#e0444b'], ['#e7f7fa', '#0a93ad']];

const P = new URLSearchParams(location.search);
const q = (P.get('q') || '').trim().slice(0, 50);
const tab = TABS.some(t => t[0] === P.get('tab')) ? P.get('tab') : 'all';
const lv = LV.includes(P.get('lv')) ? P.get('lv') : '';
const tag = P.get('tag') || '';
// 용어별 정적 페이지(<slug>/index.html)는 AIT_BASE='../', AIT_ENTRY='용어' 를 먼저 정해 두고 이 파일을 불러온다
const BASE = window.AIT_BASE || './';
const entryName = window.AIT_ENTRY || P.get('entry');
const view = P.get('view');

// ---------- 도우미 ----------
// 저장값 모양이 기본값과 다르면(배열이어야 하는데 아니면 등) 기본값을 쓴다
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('aiterms.' + k)); return v != null && Array.isArray(v) === Array.isArray(d) && typeof v === typeof d ? v : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aiterms.' + k, JSON.stringify(v)); } catch { } },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
const strip = s => s.replace(/\(.*?\)/g, '').trim();
const qs = o => BASE + '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
// 띄어쓰기를 무시하고 찾는 정규식: "생성형ai" 가 "생성형 AI" 에 걸린다
const makeRx = (s, flags) => { const n = norm(s); return n ? new RegExp([...n].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), flags) : null; };
const rxt = makeRx(q, 'i');
const hl = (s, rx = makeRx(q, 'gi')) => {
  if (!rx) return esc(s);
  let out = '', i = 0;
  s.replace(rx, (m, off) => { out += esc(s.slice(i, off)) + '<strong class="hl">' + esc(m) + '</strong>'; i = off + m.length; return m; });
  return out + esc(s.slice(i));
};
const has = s => !!rxt && rxt.test(s);
// 표제어, 영문, 다른 이름, 주의할 표기와 맞는 정도: 3 같음, 2 앞부분, 1 포함, 0 없음
function score(t, n = norm(q)) {
  if (!n) return 0;
  let best = 0;
  for (const k of [t.term, t.en, ...(t.alias || []), ...t.note.no.map(strip)]) {
    const x = norm(k);
    const s = x === n ? 3 : x.startsWith(n) ? 2 : x.includes(n) ? 1 : 0;
    if (s > best) best = s;
  }
  return best;
}
const topics = t => t.tags.filter(x => !HIDE.has(x));
const byName = n => T.find(t => t.term === n);
const day = Math.floor((Date.now() + 9 * 36e5) / 864e5); // 한국 날짜 기준으로 하루마다 바뀜
const pickDaily = (arr, n, salt = 0) => { const out = []; for (let i = 0; i < Math.min(n, arr.length); i++) out.push(arr[(day * 7 + salt + i * 13) % arr.length]); return [...new Set(out)]; };
const allTopics = (() => { const m = new Map(); T.forEach(t => topics(t).forEach(x => m.set(x, (m.get(x) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]); })();

// 저장 상태
const saved = () => store.get('words', []);
const recent = () => store.get('recent', []);
const autosave = () => store.get('autosave', true);
if (q && autosave()) store.set('recent', [q, ...recent().filter(x => x !== q)].slice(0, 10));
document.documentElement.style.setProperty('--fs', [0.9, 1, 1.15][store.get('fs', 1)] || 1);

// ---------- 조각 ----------
const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
const logo = `<a class="logo" href="${BASE}"><span class="mark">AI</span>용어사전</a>`;
const lvBadge = t => `<span class="lv lv-${t.level}">${t.level}</span>`;
const addBtn = t => { const on = saved().includes(t.term); return `<button class="add" data-add="${esc(t.term)}" aria-pressed="${on}" title="${on ? '단어장에서 빼기' : '단어장에 담기'}" aria-label="${esc(t.term)} ${on ? '단어장에서 빼기' : '단어장에 담기'}">${on ? '✓' : '+'}</button>`; };
const fld = t => topics(t)[0] ? `<span class="fld">(${esc(topics(t)[0])})</span> ` : '';
// 주소 이름: 표제어가 영문이면 표제어(RAG → rag), 아니면 영문 원어(프롬프트 → prompt)
const slug = t => (/^[\x20-\x7e]+$/.test(t.term) ? t.term : t.en).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ent = t => `${BASE}${slug(t)}/`;

function searchForm(big) {
  const adv = big ? `<button type="button" class="adv-btn" data-adv aria-expanded="false" aria-controls="adv">고급 검색</button>` : '';
  const panel = big ? `<div class="adv" id="adv" hidden><b>난이도</b>${['', ...LV].map(l => `<label><input type="radio" name="lv" value="${l}"${l === lv ? ' checked' : ''}>${l || '전체'}</label>`).join('')}<span class="date">검색어 없이 난이도만 고르면 그 난이도 용어를 모두 보여 줍니다.</span></div>`
    : (lv ? `<input type="hidden" name="lv" value="${lv}">` : '');
  return `<form class="sform${big ? ' big' : ''}" action="${BASE}" role="search" autocomplete="off">
    <div class="srow"><div class="sbox">
      <input name="q" value="${esc(q)}" placeholder="AI 용어를 입력해 주세요" aria-label="AI 용어 검색" maxlength="50" autocapitalize="off" spellcheck="false">
      <button type="button" class="clr" data-clr aria-label="검색어 지우기"${q ? '' : ' hidden'}>×</button>
      <button class="go" aria-label="검색">${icon}</button>
      <ul class="ac" role="listbox" hidden></ul>
    </div>${adv}</div>${panel}</form>`;
}

const recentChips = (limit) => recent().slice(0, limit).map(w => `<span class="chip"><a href="${qs({ q: w })}">${esc(w)}</a><button data-del="${esc(w)}" aria-label="${esc(w)} 지우기">×</button></span>`).join('');

const TIPS = [
  '띄어쓰기는 신경 쓰지 않아도 됩니다. "생성형ai"로 찾아도 "생성형 AI"가 나옵니다.',
  '영어로도 찾을 수 있습니다. "hallucination", "fine-tuning"처럼 원어를 넣어 보세요.',
  '헷갈리는 표기로 찾아도 됩니다. "프롬트"를 찾으면 바른 표기 "프롬프트"를 알려 줍니다.',
  '표제어 옆 + 버튼을 누르면 내 단어장에 담깁니다. 단어장은 이 브라우저에만 저장됩니다.',
  '뜻풀이는 쉬운 말 → 실무 → 전문 순서로 쌓여 있습니다. 필요한 깊이까지만 읽으세요.',
];
const tipsBox = () => `<div class="box tips"><h3>사전 사용팁<span class="tipnav"><span data-tipno>1 / ${TIPS.length}</span><button data-tip="-1" aria-label="이전 팁">‹</button><button data-tip="1" aria-label="다음 팁">›</button></span></h3><p data-tiptext aria-live="polite">${TIPS[0]}</p></div>`;

const wordbookBox = () => {
  const w = saved();
  return `<div class="box"><h3>내 단어장 <a href="${qs({ view: 'wordbook' })}">전체 ${w.length} ›</a></h3>${w.length
    ? `<ul class="wb">${w.slice(0, 6).map(x => `<li><a href="${qs({ entry: x })}">${esc(x)}</a><button class="txtbtn" data-add="${esc(x)}" aria-label="${esc(x)} 단어장에서 빼기">빼기</button></li>`).join('')}</ul>`
    : '<p class="empty-s">표제어 옆 + 를 눌러 단어를 담아 보세요.</p>'}</div>`;
};

// ---------- 첫 화면 ----------
function home() {
  document.body.className = 'home';
  const r = recent();
  const fixes = T.filter(t => t.note.no.length && t.note.tip && !/허용|널리|흔|혼동|다른/.test(t.note.no[0]));
  const cardsFix = pickDaily(fixes, 3, 1).map(t => `<a class="card" href="${qs({ q: t.term, tab: 'spell' })}">
      <span class="q">AI 바로쓰기</span>
      <span class="fix"><span class="bad">${esc(strip(t.note.no[0]))}</span><span class="arr">→</span><span class="good">${esc(t.term)}</span></span>
      <p>${esc(t.note.tip)}</p></a>`).join('');
  const today = LV.flatMap((l, i) => pickDaily(T.filter(t => t.level === l), 2, i * 5)).map(t => `<a class="card" href="${ent(t)}">
      <span>${lvBadge(t)}</span>
      <span class="ttl">${esc(t.term)}<small>${esc(t.en)}</small></span>
      <p>${esc(t.defs[0].text)}</p>
      <span class="meta">${topics(t).map(x => '#' + esc(x)).join(' ')}</span></a>`).join('');
  const pills = allTopics.map(([x, n], i) => { const [b, c] = PALETTE[i % PALETTE.length]; return `<a class="pill" style="background:${b};color:${c}" href="${qs({ tag: x })}">#${esc(x)}<small>${n}</small></a>`; }).join('');
  const cnt = l => T.filter(t => t.level === l).length;

  return `<header class="gnb">${logo}<nav><a href="${qs({ view: 'all' })}">전체 용어</a><a href="${qs({ view: 'notation' })}">AI 바로쓰기</a><a href="${qs({ view: 'wordbook' })}">내 단어장</a></nav></header>
  <section class="hero">
    <h1><em>AI</em> <span style="margin-right:.026em">용</span><span style="margin-right:-.017em">어</span><span style="margin-right:.07em">사</span>전</h1>
    <p class="sub">일상 말부터 실무 용어, 더 나아가 전문 용어까지.</p>
    ${searchForm(true)}
    ${r.length ? `<div class="recent"><span class="lbl">최근 검색어</span>${recentChips(5)}<span data-morechips hidden>${r.slice(5).map(w => `<span class="chip"><a href="${qs({ q: w })}">${esc(w)}</a><button data-del="${esc(w)}" aria-label="${esc(w)} 지우기">×</button></span>`).join('')}</span><span class="ctl">${r.length > 5 ? '<button class="txtbtn" data-more>더보기</button>|' : ''}<button class="txtbtn" data-delall>모두삭제</button></span></div>` : ''}
  </section>
  <div class="wrap"><main>
    <section class="blk"><div class="blk-h"><h2>AI 바로쓰기<small>헷갈리는 AI 용어 표기</small></h2><a href="${qs({ view: 'notation' })}">더보기 ›</a></div><div class="cards">${cardsFix}</div></section>
    <section class="blk"><div class="blk-h"><h2>오늘의 AI 용어<small>날마다 바뀝니다</small></h2><a href="${qs({ view: 'all' })}">전체 용어 ›</a></div><div class="cards">${today}</div></section>
    <section class="blk"><div class="blk-h"><h2>주제별 찾기</h2></div><div class="pills">${pills}</div></section>
    <section class="blk"><div class="blk-h"><h2>난이도별 전체 용어<small>${T.length}개</small></h2></div>${LV.map(l => { const li = t => `<li><a href="${ent(t)}">${esc(t.term)}</a></li>`, ts = T.filter(t => t.level === l);   // terms.js 가 난이도마다 많이 쓰는 순서
      return `<h3 class="idx-h">${lvBadge({ level: l })} ${LVNAME[l]}<small>${ts.length}개</small></h3><ul class="idx">${ts.slice(0, 20).map(li).join('')}</ul><ul class="idx" hidden>${ts.slice(20).map(li).join('')}</ul><button type="button" class="idx-more" data-more aria-expanded="false">펼치기</button>`; }).join('')}</section>
  </main>
  <aside>
    <div class="links3"><a href="${qs({ view: 'wordbook' })}">내 단어장</a><a href="${qs({ view: 'all' })}">전체 용어</a><a href="${qs({ view: 'notation' })}">표기법</a></div>
    <div class="box notice"><h3>공지사항</h3><ul>
      <li><a href="${qs({ view: 'all' })}">AI 용어사전이 문을 열었습니다<span class="n">N</span></a><span class="date">2026.10.14</span></li>
      <li><a href="${qs({ lv: '전문' })}">전문 용어 뜻풀이를 함께 실었습니다</a><span class="date">2026.10.14</span></li>
    </ul></div>
    <div class="box"><h3>난이도별 찾기</h3><ul class="lvlist">${LV.map(l => `<li><a href="${qs({ lv: l })}"><b>${lvBadge({ level: l })} ${LVNAME[l]}</b><span>${cnt(l)}개 ›</span></a></li>`).join('')}</ul></div>
    <div class="btns2"><a href="${qs({ view: 'notation' })}">AI 바로쓰기</a><a href="${qs({ q: '할루시네이션' })}">많이 찾는 말</a></div>
    ${wordbookBox()}
    ${tipsBox()}
  </aside></div>`;
}

// ---------- 검색 결과 ----------
function frame(main, withTabs) {
  document.body.className = 'res';
  const fs = store.get('fs', 1);
  const tabs = withTabs ? `<ul>${TABS.map(([k, name]) => `<li><a href="${qs({ q, lv, tab: k === 'all' ? '' : k })}"${k === tab ? ' aria-current="page"' : ''}>${name}</a></li>`).join('')}</ul>` : '<ul></ul>';
  const r = recent();
  return `<div class="top"><header class="gnb">${logo}${searchForm(false)}</header></div>
  <nav class="tabs" aria-label="검색 결과 구분"><div class="tabs-in">${tabs}
    <div class="fsz" role="group" aria-label="글자 크기">${['작게', '보통', '크게'].map((n, i) => `<button data-fs="${i}" aria-pressed="${fs === i}" aria-label="글자 ${n}">T</button>`).join('')}</div></div></nav>
  <div class="wrap"><main>${main}</main>
  <aside>
    <div class="box"><h3>내가 찾은 단어 <label class="sw"><input type="checkbox" data-autosave${autosave() ? ' checked' : ''}>자동저장</label></h3>
      ${r.length ? `<div class="chips">${recentChips(10)}</div><div class="bot"><button class="txtbtn" data-saveall>모두저장</button>|<button class="txtbtn" data-delall>모두삭제</button></div>` : '<p class="empty-s">최근 검색어가 없습니다.</p>'}</div>
    ${wordbookBox()}
    <div class="btns2"><a href="${qs({ view: 'notation' })}">AI 바로쓰기</a><a href="${qs({ view: 'all' })}">전체 용어</a></div>
    ${tipsBox()}
  </aside></div>`;
}

function wordItem(t, full, hlText) {
  const defs = full ? t.defs : t.defs.slice(0, 1);
  const show = s => hlText ? hl(s) : esc(s);
  return `<li class="item"><div class="hw"><a class="w" href="${ent(t)}">${esc(t.term)}</a><span class="orig">${esc(t.en)}</span>${lvBadge(t)}${addBtn(t)}</div>
    <ol class="means${defs.length > 1 ? ' multi' : ''}">${defs.map(d => `<li><span class="pos">[${t.pos}]</span> ${fld(t)}${show(d.text)}<span class="src">${esc(d.src)}</span></li>`).join('')}</ol>
    ${!full && t.defs.length > 1 ? `<a class="morelink" href="${ent(t)}">쉬운/실무/전문 뜻풀이 ${t.defs.length}개 모두 보기 ›</a>` : ''}</li>`;
}
const idiomItem = ({ p, d, t }) => `<li class="item"><a class="idm" href="${ent(t)}">${hl(p)}</a><div class="mean">${esc(d)}</div><span class="src"><a href="${ent(t)}">${esc(t.term)}</a> 관련 표현</span></li>`;
const defItem = ({ t, d }) => `<li class="item"><div class="hw"><a class="w" href="${ent(t)}">${esc(t.term)}</a><span class="orig">${esc(t.en)}</span>${lvBadge(t)}</div><div class="mean">${hl(d.text)}</div><span class="src">${esc(d.src)}</span></li>`;
const exItem = ({ t, e }) => `<li class="item"><div>${hl(e)}</div><span class="src"><a href="${ent(t)}">${esc(t.term)}</a> 예문</span></li>`;
const spellItem = t => `<li class="item"><div class="hw"><a class="w" href="${ent(t)}">${esc(t.term)}</a>${lvBadge(t)}</div>${spellDl(t)}</li>`;
const spellDl = t => `<dl class="sp"><dt>바른 표기</dt><dd class="ok">${esc(t.note.ok)}</dd>
  ${t.note.no.length ? `<dt>주의할 표기</dt><dd class="nos">${t.note.no.map(n => { const m = n.match(/^(.*?)(\(.*\))?$/); return `<span>${esc(m[1].trim())}${m[2] ? ` <small>${esc(m[2])}</small>` : ''}</span>`; }).join('')}</dd>` : ''}
  <dt>원어</dt><dd>${esc(t.note.en)}</dd>${t.alias?.length ? `<dt>다른 이름</dt><dd>${t.alias.map(esc).join(', ')}</dd>` : ''}${t.note.tip ? `<dt>참고</dt><dd>${esc(t.note.tip)}</dd>` : ''}</dl>`;

function results() {
  const n = norm(q);
  const pool = lv ? T.filter(t => t.level === lv) : T;
  const sc = new Map(pool.map(t => [t, score(t)]));
  const words = pool.filter(t => sc.get(t)).sort((a, b) => sc.get(b) - sc.get(a));
  const isNo = t => t.note.no.some(x => norm(strip(x)) === n);
  const idioms = pool.flatMap(t => (t.idioms || []).filter(i => has(i.p) || sc.get(t) === 3).map(i => ({ ...i, t })));
  const defs = pool.flatMap(t => t.defs.filter(d => has(d.text)).map(d => ({ t, d })));
  const exs = pool.flatMap(t => t.ex.filter(e => has(e) || sc.get(t) === 3).map(e => ({ t, e })));
  const spells = pool.filter(t => sc.get(t) >= 2 || isNo(t));
  // 헷갈리는 표기로 찾았을 때 바른 표기 안내
  const exact = words.filter(t => sc.get(t) === 3 && norm(t.term) === n);
  const fix = !exact.length && T.find(t => isNo(t) && norm(t.term) !== n);
  const fixNote = fix && fix.note.no.find(x => norm(strip(x)) === n);

  const S = {
    word: ['단어', words, t => wordItem(t, tab === 'word', false), 5],
    idiom: ['관용구', idioms, idiomItem, 3],
    def: ['뜻풀이', defs, defItem, 3],
    ex: ['예문', exs, exItem, 3],
    spell: ['맞춤법/표기법', spells, spellItem, 2],
  };
  const section = (k, limit) => {
    const [title, arr, fn] = S[k];
    if (!arr.length) return '';
    const shown = limit ? arr.slice(0, limit) : arr;
    return `<section class="sec"><h3>${title}<em>${arr.length}</em></h3><ul class="list">${shown.map(fn).join('')}</ul>${limit && arr.length > limit ? `<a class="more" href="${qs({ q, lv, tab: k })}">${title} 더보기 ›</a>` : ''}</section>`;
  };
  const filter = `<div class="filter">${['', ...LV].map(l => `<a href="${qs({ q, lv: l, tab: tab === 'all' ? '' : tab })}"${l === lv ? ' aria-current="true"' : ''}>${l ? LVNAME[l] : '전체'}</a>`).join('')}</div>`;
  const fixbar = fix ? `<div class="fixbar">'${esc(q)}'의 바른 표기는 <a href="${qs({ q: fix.term })}"><b>${esc(fix.note.ok)}</b></a>입니다.${/\(/.test(fixNote) ? `<small>${esc(fixNote.match(/\((.*)\)/)[1])}</small>` : ''}</div>` : '';
  const total = words.length + idioms.length + defs.length + exs.length + spells.length;
  const body = tab === 'all' ? Object.keys(S).map(k => section(k, S[k][3])).join('') : section(tab, 0);
  const sugg = pickDaily(T, 8, 3).map(t => `<span class="chip"><a href="${qs({ q: t.term })}">${esc(t.term)}</a></span>`).join('');
  const none = `<div class="none"><h3>'<em>${esc(q)}</em>'에 대한 ${tab === 'all' ? '' : S[tab][0] + ' '}검색결과가 없습니다.</h3>
    <ul><li>단어의 철자가 정확한지 확인해 보세요.</li><li>영어 원어나 줄임말(예: LLM, RAG)로도 찾아보세요.</li>${lv ? '<li>위 난이도 거르기를 \'전체\'로 바꿔 보세요.</li>' : ''}${tab !== 'all' && total ? `<li><a href="${qs({ q, lv })}" style="color:var(--blue)">전체 탭</a>에는 결과가 있습니다.</li>` : ''}</ul>
    <div class="chips">${sugg}</div></div>`;
  return frame(filter + fixbar + (body || none), true);
}

// ---------- 목록 화면(주제, 난이도, 전체, 표기법, 단어장) ----------
function browse() {
  let title, desc, list, item = t => wordItem(t, false, false);
  if (view === 'wordbook') { list = saved().map(byName).filter(Boolean); title = '내 단어장'; desc = '이 브라우저에만 저장됩니다. 다른 기기와 공유되지 않습니다.'; }
  else if (view === 'notation') { list = T.filter(t => t.note.no.length || t.note.tip); title = 'AI 바로쓰기'; desc = '헷갈리기 쉬운 AI 용어의 바른 표기와 주의할 표기를 모았습니다.'; item = spellItem; }
  else if (tag) { list = T.filter(t => t.tags.includes(tag)); title = '#' + tag; desc = `'${tag}' 주제의 AI 용어`; }
  else if (lv) { list = T.filter(t => t.level === lv); title = LVNAME[lv]; desc = { 일상: '뉴스, 대화에서 가볍게 쓰는 AI 말', 실무: '회사, 기업 현장에서 쓰는 AI 용어', 전문: '연구, 개발에서 쓰는 AI 전문 용어' }[lv]; }
  else { list = T; title = '전체 용어'; desc = '가나다/ABC 순'; }
  if (!view && !tag && !lv) list = [...T];
  if (view !== 'wordbook') list = [...list].sort((a, b) => a.term.localeCompare(b.term, 'ko'));
  const head = `<div class="pagehead"><h2>${esc(title)}<em>${list.length}</em></h2><p>${esc(desc)}</p></div>`;
  const levelFilter = view === 'all' || (!view && !tag && lv) ? `<div class="filter">${['', ...LV].map(l => `<a href="${l ? qs({ lv: l }) : qs({ view: 'all' })}"${l === lv ? ' aria-current="true"' : ''}>${l ? LVNAME[l] : '전체'}</a>`).join('')}</div>` : '';
  const body = list.length ? `<section class="sec"><ul class="list">${list.map(item).join('')}</ul></section>` : `<div class="none"><h3>담은 단어가 없습니다.</h3><p class="empty-s">검색 결과에서 표제어 옆 + 를 눌러 보세요.</p></div>`;
  return frame(head + levelFilter + body, false);
}

// ---------- 표제어 화면 ----------
function entryPage(t) {
  const groups = [];
  t.defs.forEach(d => { const g = groups.find(x => x.src === d.src); g ? g.items.push(d.text) : groups.push({ src: d.src, items: [d.text] }); });
  const rel = (t.rel || []).map(r => { const x = byName(r); return `<a href="${x ? ent(x) : qs({ q: r })}">${esc(r)}</a>`; }).join('');
  const main = `<p class="crumb"><a href="${BASE}">AI 용어사전</a> › ${topics(t).map(x => `<a href="${qs({ tag: x })}">${esc(x)}</a>`).join(', ')}</p>
  <section class="sec ent">
    <div class="ent-h"><div class="hw"><h1 class="w">${esc(t.term)}</h1><span class="orig">${esc(t.en)}</span>${lvBadge(t)}${addBtn(t)}</div>
      ${t.alias?.length ? `<p class="alias">다른 이름: ${t.alias.map(esc).join(', ')}</p>` : ''}</div>
    <h4>뜻풀이</h4>${groups.map(g => `<p class="dsrc">${esc(g.src)}</p><ol class="means${g.items.length > 1 ? ' multi' : ''}">${g.items.map(x => `<li><span class="pos">[${t.pos}]</span> ${fld(t)}${esc(x)}</li>`).join('')}</ol>`).join('')}
    ${t.idioms?.length ? `<h4>관용구/함께 쓰는 말</h4><ul class="idl">${t.idioms.map(i => `<li><b>${esc(i.p)}</b> - ${esc(i.d)}</li>`).join('')}</ul>` : ''}
    ${t.like ? `<h4>쉬운 비유</h4><p class="like">${esc(t.like)}</p>` : ''}
    <h4>예문</h4><ul class="exl">${t.ex.map(e => `<li>${hl(e, makeRx(t.term, 'gi'))}</li>`).join('')}</ul>
    ${t.vs?.length ? `<h4>헷갈리는 용어 비교</h4><dl class="sp vs">${t.vs.map(v => { const x = byName(v.w); return `<dt>${x ? `<a href="${ent(x)}">${esc(v.w)}</a>` : esc(v.w)}</dt><dd>${esc(v.d)}</dd>`; }).join('')}</dl>` : ''}
    <h4>맞춤법/표기법</h4>${spellDl(t)}
    ${rel ? `<h4>관련어</h4><div class="rel">${rel}</div>` : ''}
  </section>`;
  return frame(main, false);
}

// ---------- 그리기 ----------
function render() {
  const app = document.getElementById('app');
  const t = entryName && byName(entryName);
  if (t && !window.AIT_ENTRY) { location.replace(ent(t)); } // 예전 ?entry= 주소는 정적 페이지로
  else if (t) { app.innerHTML = entryPage(t); }
  else if (q) { document.title = `${q} : AI 용어사전`; app.innerHTML = results(); }
  else if (entryName) { location.replace(qs({ q: entryName })); }
  else if (view || tag || lv) { document.title = 'AI 용어사전'; app.innerHTML = browse(); }
  else { document.title = 'AI 용어사전'; app.innerHTML = home(); }
}
render();

// ---------- 동작 ----------
let tipIdx = 0;
document.addEventListener('click', e => {
  const b = e.target.closest('button,[data-adv]');
  if (!e.target.closest('.sbox')) document.querySelectorAll('.ac').forEach(u => u.hidden = true);
  if (!b) return;
  const d = b.dataset;
  if (d.more !== undefined) {   // 난이도별 전체 용어: 나머지 목록 펼치기/접기, 버튼은 목록 아래
    const u = b.previousElementSibling, open = u.hidden; u.hidden = !open;
    b.textContent = open ? '접기' : '펼치기'; b.setAttribute('aria-expanded', open); return;
  }
  if (d.add !== undefined) {
    const w = saved(); store.set('words', w.includes(d.add) ? w.filter(x => x !== d.add) : [d.add, ...w]);
    render();
  } else if (d.del !== undefined) { store.set('recent', recent().filter(x => x !== d.del)); render(); }
  else if (d.delall !== undefined) { store.set('recent', []); render(); }
  else if (d.saveall !== undefined) { const w = saved(); store.set('words', [...w, ...recent().filter(x => byName(x) && !w.includes(x))]); render(); }
  else if (d.more !== undefined) { document.querySelector('[data-morechips]').hidden = false; b.remove(); }
  else if (d.fs !== undefined) { store.set('fs', +d.fs); document.documentElement.style.setProperty('--fs', [0.9, 1, 1.15][+d.fs]); document.querySelectorAll('[data-fs]').forEach(x => x.setAttribute('aria-pressed', x === b)); }
  else if (d.tip !== undefined) { tipIdx = (tipIdx + +d.tip + TIPS.length) % TIPS.length; document.querySelectorAll('[data-tiptext]').forEach(p => p.textContent = TIPS[tipIdx]); document.querySelectorAll('[data-tipno]').forEach(s => s.textContent = `${tipIdx + 1} / ${TIPS.length}`); }
  else if (d.adv !== undefined) { const p = document.getElementById('adv'); p.hidden = !p.hidden; b.setAttribute('aria-expanded', !p.hidden); }
  else if (d.clr !== undefined) { const i = b.form.q; i.value = ''; b.hidden = true; b.form.querySelector('.ac').hidden = true; i.focus(); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-autosave]')) store.set('autosave', e.target.checked); });
// 자동완성
document.addEventListener('input', e => {
  const inp = e.target;
  if (inp.name !== 'q' || !inp.form) return;
  const ul = inp.form.querySelector('.ac'), v = norm(inp.value);
  inp.form.querySelector('[data-clr]').hidden = !inp.value;
  if (!v) { ul.hidden = true; return; }
  const rx = makeRx(v, 'gi');
  const hits = T.map(t => [t, score(t, v)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  ul.innerHTML = hits.map(([t]) => `<li role="option"><a href="${qs({ q: t.term })}"><b>${hl(t.term, rx)}</b><span>${esc(t.en)}</span></a></li>`).join('');
  ul.hidden = !hits.length;
});
document.addEventListener('keydown', e => {
  const ul = e.target.closest('.sbox')?.querySelector('.ac');
  if (!ul || ul.hidden) return;
  const links = [...ul.querySelectorAll('a')], i = links.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const nx = e.key === 'ArrowDown' ? i + 1 : i - 1;
    (nx < 0 ? e.target.closest('.sbox').querySelector('input') : links[Math.min(nx, links.length - 1)]).focus();
  } else if (e.key === 'Escape') { ul.hidden = true; e.target.closest('.sbox').querySelector('input').focus(); }
});
document.addEventListener('submit', e => {
  // 빈 검색어 + 난이도 없음이면 첫 화면에 머문다
  const f = e.target, v = f.q.value.trim(), l = f.querySelector('[name=lv]:checked,[type=hidden][name=lv]')?.value;
  if (!v && !l) { e.preventDefault(); f.q.focus(); return; }
  e.preventDefault();
  location.href = qs({ q: v, lv: l });
});
