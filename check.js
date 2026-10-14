// 검색 로직 점검: node check.js  (브라우저 없이 app.js 를 주소별로 그려 보고 결과 HTML 을 확인)
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/data/terms.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/app.js', 'utf8');
function page(search) {
  const app = { innerHTML: '' }, mem = {};
  const ctx = {
    URLSearchParams, console,
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
has(page('?q=' + encodeURIComponent('프롬프트')), '<em>', 'class="w"', '프롬프트', '맞춤법·표기법');
has(page('?q=' + encodeURIComponent('프롬트')), 'class="fixbar"', '프롬프트');           // 틀린 표기 → 바른 표기 안내
has(page('?q=' + encodeURIComponent('생성형ai')), '생성형 AI');                          // 띄어쓰기 무시
has(page('?q=hallucination'), '할루시네이션');                                          // 영어 원어
has(page('?q=' + encodeURIComponent('<script>')), '&lt;script&gt;');                    // 이스케이프
assert(!page('?q=' + encodeURIComponent('<img src=x>')).includes('<img src=x>'));
has(page('?q=zzzzqqq'), 'class="none"');
has(page('?entry=' + encodeURIComponent('챗GPT')), '뜻풀이', '예문', '관련어');
has(page('?tag=' + encodeURIComponent('에이전트')), 'pagehead');
has(page('?view=notation'), 'AI 바로쓰기');
for (const t of ['word', 'idiom', 'def', 'ex', 'spell']) page('?q=AI&tab=' + t);
console.log('check ok');
