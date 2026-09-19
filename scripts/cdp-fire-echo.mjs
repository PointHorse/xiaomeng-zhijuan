/* 让应用内 plugin-http 发 POST 到 127.0.0.1:80 回显服务器，抓 reqwest 真实报文 */
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const r = await send('Runtime.evaluate', { expression: `(async () => {
  const inv = window.__TAURI_INTERNALS__.invoke;
  const body = JSON.stringify({ model: 'glm-5.3-flash', messages: [{ role: 'user', content: 'hi' }], stream: true });
  const rid = await inv('plugin:http|fetch', { clientConfig: { method: 'POST', url: 'http://127.0.0.1/v1/chat/completions', headers: [['Content-Type','application/json'],['Authorization','Bearer sk_test']], data: Array.from(new TextEncoder().encode(body)) } });
  const sent = await inv('plugin:http|fetch_send', { rid });
  return 'HTTP ' + sent.status;
})()`, awaitPromise: true, returnByValue: true, silent: true });
console.log('in-app:', r.result?.result?.value ?? 'EXC');
ws.close();
process.exit(0);
