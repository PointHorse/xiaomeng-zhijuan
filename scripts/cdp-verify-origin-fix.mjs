/* 验证修复：带空 Origin 头（unsafe-headers feature 生效时应被 Rust 移除）→ 应 200 */
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, silent: true });
  if (r.result?.exceptionDetails) return 'EXCEPTION: ' + String(r.result.exceptionDetails.exception?.description ?? '').slice(0, 600);
  return r.result?.result?.value;
}
const expr = `(async () => {
  const inv = window.__TAURI_INTERNALS__.invoke;
  const KEY = 'sk_tr_k0MmqWIlHoyqVPypwR1EolG5ZUfzbYhBv7hNPuHuv70';
  const out = {};
  async function post(label, headers) {
    const body = JSON.stringify({ model: 'glm-5.3-flash', messages: [{ role: 'user', content: '回复两个字：你好' }], stream: false, max_tokens: 300 });
    const rid = await inv('plugin:http|fetch', { clientConfig: { method: 'POST', url: 'https://tokenrhythm.studio/v1/chat/completions', headers, data: Array.from(new TextEncoder().encode(body)) } });
    const sent = await inv('plugin:http|fetch_send', { rid });
    let text = '';
    for (;;) {
      let d; try { d = await inv('plugin:http|fetch_read_body', { rid: sent.rid }); } catch { break; }
      if (!d) break;
      const u8 = new Uint8Array(d);
      if (u8[u8.byteLength - 1] === 1) break;
      text += new TextDecoder().decode(u8.slice(0, u8.byteLength - 1));
      if (text.length > 800) break;
    }
    out[label] = 'HTTP ' + sent.status + ' · ' + text.slice(0, 100);
  }
  await post('空Origin', [['Content-Type','application/json'],['Authorization','Bearer '+KEY],['Origin','']]);
  await post('无Origin(对照,应403)', [['Content-Type','application/json'],['Authorization','Bearer '+KEY]]);
  return JSON.stringify(out, null, 2);
})()`;
console.log(await evaluate(expr));
ws.close();
process.exit(0);
