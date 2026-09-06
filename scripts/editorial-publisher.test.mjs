import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateArticle,publicationSql} from './editorial-publisher.mjs';
const config=JSON.parse(await readFile('content/editorial/config.json','utf8'));
const {readdir}=await import('node:fs/promises');
const filename=(await readdir('content/editorial/articles')).find(f=>f.endsWith('.json'));
const article=JSON.parse(await readFile(`content/editorial/articles/${filename}`,'utf8'));
test('reviewed article passes',()=>assert.ok(validateArticle(article,config).words>=450));
test('wrong project and unsafe content are rejected',()=>{
 assert.throws(()=>validateArticle({...article,site:'another-site'},config),/destination/);
 assert.throws(()=>validateArticle({...article,content_html:article.content_html+'<img src=x onerror="alert(1)">'},config),/unsafe markup/);
 assert.throws(()=>validateArticle({...article,content_html:article.content_html+'<a href="https://unreviewed.example/">link</a>'},config),/external link not checked/);
});
test('publication SQL guards conflicts without overwriting rows',()=>{
 const sql=publicationSql(article,config);
 assert.match(sql,/ON CONFLICT \(slug\) DO NOTHING/);
 assert.match(sql,/Editorial duplicate/);
 assert.match(sql,/END; \$editorial_guard_[a-z0-9]+\$/);
 assert.doesNotMatch(sql,/UPDATE public\.blog_posts|DELETE FROM/i);
});
test('affiliate cannot be attributed to another channel or lose disclosure',()=>{
 if(!article.affiliate_links?.length)return;
 const wrong=structuredClone(article);wrong.affiliate_links[0].url=wrong.affiliate_links[0].url.replace('as=2056181186','as=999');
 assert.throws(()=>validateArticle(wrong,config),/not verified/);
 assert.throws(()=>validateArticle({...article,content_html:article.content_html.replace('sponsored noopener','noopener')},config),/rel=sponsored/);
 assert.throws(()=>validateArticle({...article,content_html:article.content_html.replace('Annonslänkar:','Länkar:')},config),/disclosure/);
});
