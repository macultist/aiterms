// 검색 로직 점검: node check.js  (브라우저 없이 app.js 를 주소별로 그려 보고 결과 HTML 을 확인)
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/data/terms.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/app.js', 'utf8');
function page(search, extra = {}) {
  const app = { innerHTML: '' }, mem = {};
  const ctx = {
    URLSearchParams, console, ...extra,
    location: { search, replace(u) { app.redirect = u; } },
    localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => mem[k] = v },
    document: { title: '', body: {}, documentElement: { style: { setProperty() {} } }, getElementById: () => app, addEventListener() {} },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  return app.innerHTML || app.redirect;
}
const has = (s, ...xs) => xs.forEach(x => assert(s.includes(x), 'missing: ' + x));
has(page(''), '용어사전', '주제별 찾기', '오늘의 AI 용어');
has(page('?q=' + encodeURIComponent('프롬프트')), '<em>', 'class="w"', '프롬프트', '맞춤법/표기법');
has(page('?q=' + encodeURIComponent('프롬트')), 'class="fixbar"', '프롬프트');           // 틀린 표기 → 바른 표기 안내
has(page('?q=' + encodeURIComponent('생성형ai')), '생성형 AI');                          // 띄어쓰기 무시
has(page('?q=hallucination'), '할루시네이션');                                          // 영어 원어
has(page('?q=' + encodeURIComponent('<script>')), '&lt;script&gt;');                    // 이스케이프
assert(!page('?q=' + encodeURIComponent('<img src=x>')).includes('<img src=x>'));
has(page('?q=zzzzqqq'), 'class="none"');
has(page('?q=' + encodeURIComponent('맵핑')), 'class="fixbar"', 'class="w"', '매핑');     // 주의할 표기로 찾아도 단어가 나온다
// 같은 말이 다른 이름(alias)과 주의할 표기(note.no)에 같이 있으면 안 된다
{ const w = {}; vm.runInNewContext(fs.readFileSync(__dirname + '/data/terms.js', 'utf8'), { window: w });
  const k = s => String(s).replace(/\(.*?\)/g, '').toLowerCase().replace(/\s+/g, '');
  const bad = w.TERMS.flatMap(t => t.note.no.filter(x => x.replace(/\(.*?\)/g, '').trim() === t.term || t.alias.some(a => k(a) === k(x))).map(x => t.term + ': ' + x));
  assert.strictEqual(bad.length, 0, 'alias/no 겹침 ' + bad.slice(0, 5).join(', ')); }
has(page('?entry=' + encodeURIComponent('챗GPT')), 'chatgpt/');                          // 예전 주소 → 정적 페이지
has(page('', { AIT_BASE: '../', AIT_ENTRY: '챗GPT' }), '<h1 class="w">', '뜻풀이', '예문', '관련어', '../?tag=', 'href="../rag/'.slice(0, 9));
// 정적 페이지: 용어 수만큼, 주소 겹침 없이
require('child_process').execFileSync('node', [__dirname + '/build.js']);
const n = (fs.readFileSync(__dirname + '/data/terms.js', 'utf8').match(/\bterm:/g) || []).length || (fs.readFileSync(__dirname + '/data/terms.js', 'utf8').match(/"term":/g) || []).length;
const pages = fs.readdirSync(__dirname).filter(d => fs.existsSync(`${__dirname}/${d}/index.html`));
assert.strictEqual(pages.length, n, 'pages ' + pages.length + ' != terms ' + n);
const one = fs.readFileSync(__dirname + '/rag/index.html', 'utf8');
has(one, '<link rel="canonical"', '<h1 class="w">', '<meta name="description"');
const idx = fs.readFileSync(__dirname + '/index.html', 'utf8'); // 첫 화면도 JS 없이 내용, 링크가 보여야 한다
has(idx, '<link rel="canonical" href="https://macultist.kr/aiterms/"', '<h1>', 'og:title', 'href="./rag/"');
assert.strictEqual(new Set(idx.match(/href="\.\/[a-z0-9-]+\/"/g)).size, n);
assert.strictEqual((fs.readFileSync(__dirname + '/sitemap.xml', 'utf8').match(/<loc>/g) || []).length, n + 2);
has(page('?tag=' + encodeURIComponent('에이전트')), 'pagehead');
has(page('?view=notation'), 'AI 바로쓰기');
for (const t of ['word', 'idiom', 'def', 'ex', 'spell']) page('?q=AI&tab=' + t);
console.log('check ok');
