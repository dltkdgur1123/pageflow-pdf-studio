import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
const hash = text => createHash('sha256').update(text).digest('hex').slice(0,16);
const core = await readFile(new URL('core.mjs',root),'utf8');
const coreName = `core.${hash(core)}.mjs`;
const app = (await readFile(new URL('app.js',root),'utf8')).replace("from './core.mjs'",`from './${coreName}'`);
const css = await readFile(new URL('style.css',root),'utf8');
const appName = `app.${hash(app)}.js`, cssName = `style.${hash(css)}.css`;
let html = await readFile(new URL('index.html',root),'utf8');
html = html.replace(/href="style(?:\.[a-f0-9]{16})?\.css"/,`href="${cssName}"`).replace(/src="app(?:\.[a-f0-9]{16})?\.js"/,`src="${appName}"`);
for(const [name,text] of [[coreName,core],[appName,app],[cssName,css],['index.html',html]])await writeFile(new URL(name,root),text);
for(const name of await readdir(root)){
 if(/^(?:app\.[a-f0-9]{16}\.js|core\.[a-f0-9]{16}\.mjs|style\.[a-f0-9]{16}\.css)$/.test(name)&&![coreName,appName,cssName].includes(name))await unlink(new URL(name,root));
}
console.log(JSON.stringify({app:appName,core:coreName,style:cssName}));
