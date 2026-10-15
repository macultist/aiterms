// 용어별 정적 페이지 만들기: node build.js
// data/terms.js 를 읽어 첫 화면 index.html, <slug>/index.html(주소 /aiterms/rag/ 꼴), sitemap.xml 을 만든다. 화면은 app.js 가 그리는 것을 그대로 미리 그려 넣는다(검색 로봇용, JS 가 다시 덮어씀).
const fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = 'https://macultist.kr/aiterms/';
const dir = __dirname, read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// app.js 를 브라우저 없이 돌려 한 용어의 화면 HTML 을 얻는다(term 이 없으면 첫 화면)
function renderEntry(term) {
  const app = { innerHTML: '' };
  const ctx = {
    URLSearchParams, AIT_BASE: term ? '../' : './', AIT_ENTRY: term,
    location: { search: '', replace() { throw new Error('redirect: ' + term); } },
    localStorage: { getItem: () => null, setItem() {} },
    document: { title: '', body: {}, documentElement: { style: { setProperty() {} } }, getElementById: () => app, addEventListener() {} },
  };
  ctx.window = ctx;
  vm.runInNewContext(read('data/terms.js') + '\n' + read('app.js') + '\n;this.__slug = slug;', ctx);
  return { html: app.innerHTML, T: ctx.TERMS, slug: ctx.__slug };
}

const { T, slug, html: homeHtml } = renderEntry(null);
const slugs = T.map(slug);
const RESERVED = new Set(['data', 'w']);
const dup = slugs.filter((s, i) => !s || RESERVED.has(s) || slugs.indexOf(s) !== i);
if (dup.length) throw new Error('slug 겹침/빈값: ' + dup.join(', '));

// 예전에 만든 용어 폴더만 지운다(AIT_ENTRY 가 든 index.html 이 있는 폴더)
for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
  const f = path.join(dir, d.name, 'index.html');
  if (d.isDirectory() && fs.existsSync(f) && read(path.join(d.name, 'index.html')).includes('AIT_ENTRY')) fs.rmSync(path.join(dir, d.name), { recursive: true });
}
// 고칠 때마다 브라우저가 새 파일을 받도록 주소 끝에 ?v=내용지문 을 붙인다
const v = require('crypto').createHash('sha1').update(['data/terms.js', 'app.js', 'style.css'].map(read).join('')).digest('hex').slice(0, 8);
const bust = h => h.replace(/(data\/terms\.js|app\.js|style\.css)(\?v=\w+)?"/g, `$1?v=${v}"`);
const fav = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2303c75a'/%3E%3Ctext x='16' y='22' font-family='sans-serif' font-size='15' font-weight='800' fill='white' text-anchor='middle'%3EAI%3C/text%3E%3C/svg%3E">`;
// 쿠팡 파트너스 배너(공개 값, petfee, waste 와 같은 위젯). 광고는 본문 아래 한 곳만
// 구글 애널리틱스(공개 측정 ID), 모든 페이지 <head> 바로 다음에 한 번. 검색어(?q=)는 주소, 이전 주소, 제목에서 빼고 보낸다
const GA = 'G-8V2J5BZTHD';
const gtag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());function nq(s){try{var u=new URL(s);u.searchParams.delete('q');return u.href}catch(e){return s}}gtag('config','${GA}',{anonymize_ip:true,page_location:nq(location.href),page_referrer:nq(document.referrer),page_title:/[?&]q=/.test(location.search)?'검색 : AI 용어사전':document.title});</script>`;
const CP = { tracking: 'AF5048356', widget: '1029096' };
const tail = b => `<aside class="ads" aria-label="광고"><div class="ad-coupang" data-cp-widget="${CP.widget}" data-cp-tracking="${CP.tracking}"></div><p class="ad-note">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p></aside>
<footer>AI 용어사전<br>뜻풀이는 학습용 참고 자료이며 서비스, 법령 정보는 바뀔 수 있습니다.<br><a href="${b}privacy.html">개인정보처리방침</a></footer>
<script>document.querySelectorAll(".ad-coupang").forEach(function(el){var w=Math.min(680,Math.max(300,Math.floor(el.clientWidth||320))),h=140,f=document.createElement("iframe");f.src="https://ads-partners.coupang.com/widgets.html?id="+el.dataset.cpWidget+"&template=carousel&trackingCode="+el.dataset.cpTracking+"&subId=&width="+w+"&height="+h;f.width=w;f.height=h;f.frameBorder="0";f.scrolling="no";f.referrerPolicy="strict-origin-when-cross-origin";f.setAttribute("browsingtopics","");f.title="쿠팡 파트너스 추천 상품";el.appendChild(f)});</script>`;
const homeDesc = '일상에서 가볍게 쓰는 AI 말부터 회사 실무 용어, 전문 용어까지. 뜻풀이, 관용구, 예문, 표기법을 한 번에 찾는 AI 용어사전.';
fs.writeFileSync(path.join(dir, 'index.html'), bust(`<!doctype html>
<html lang="ko">
<head>
${gtag}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 용어사전</title>
<meta name="description" content="${homeDesc}">
<link rel="canonical" href="${SITE}">
<meta property="og:type" content="website"><meta property="og:title" content="AI 용어사전"><meta property="og:description" content="${homeDesc}"><meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="AI 용어사전"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image">
${fav}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="style.css">
</head>
<body class="home">
<div id="app">${homeHtml}</div>
${tail('')}
<script src="data/terms.js"></script>
<script src="app.js"></script>
</body>
</html>
`));
T.forEach((t, i) => {
  const url = `${SITE}${slugs[i]}/`;
  const title = `${t.term}(${t.en}) 뜻 : AI 용어사전`;
  const desc = (t.defs[0].text + ' ' + (t.like || '')).slice(0, 155).trim();
  const ld = { '@context': 'https://schema.org', '@type': 'DefinedTerm', name: t.term, alternateName: [t.en, ...(t.alias || [])], description: t.defs[0].text, url, inDefinedTermSet: SITE };
  const page = `<!doctype html>
<html lang="ko"><head>
${gtag}
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="AI 용어사전"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image">
${fav}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="../style.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head><body class="res">
<div id="app">${renderEntry(t.term).html}</div>
${tail('../')}
<script>var AIT_BASE='../',AIT_ENTRY=${JSON.stringify(t.term).replace(/</g, '\\u003c')};</script>
<script src="../data/terms.js"></script><script src="../app.js"></script>
</body></html>
`;
  fs.mkdirSync(path.join(dir, slugs[i]));
  fs.writeFileSync(path.join(dir, slugs[i], 'index.html'), bust(page));
});

// 개인정보처리방침: 본문은 docs/privacy.html(사이트에 직접 올라가지 않는 원본)
fs.writeFileSync(path.join(dir, 'privacy.html'), bust(`<!doctype html>
<html lang="ko"><head>
${gtag}
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>개인정보처리방침 : AI 용어사전</title>
<meta name="description" content="AI 용어사전의 개인정보처리방침입니다.">
<link rel="canonical" href="${SITE}privacy.html">
${fav}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="style.css">
</head><body class="res">
<div class="top"><header class="gnb"><a class="logo" href="./"><span class="mark">AI</span>용어사전</a></header></div>
${read('docs/privacy.html')}
${tail('')}
</body></html>
`));

// og.png(링크 미리보기 1200x630)는 docs/og.html 을 크롬 headless --window-size=1200,630 --screenshot 으로 찍은 것
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}</loc><lastmod>${today}</lastmod></url>
<url><loc>${SITE}privacy.html</loc><lastmod>2026-10-15</lastmod></url>
${T.map((t, i) => `<url><loc>${SITE}${slugs[i]}/</loc><lastmod>${t.checked || today}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log(`pages ${T.length}`);
