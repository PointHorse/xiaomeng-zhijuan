/* 二分：A=裸invoke最小头POST  B=带Request构造器  C=带Origin头  找出触发 CSRF_INVALID 的变量 */
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params) {
  return new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, silent: true });
  if (r.result?.exceptionDetails) {
    return 'EXCEPTION: ' + String(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)).slice(0, 800);
  }
  return r.result?.result?.value;
}

const expr = `(async () => {
  const inv = window.__TAURI_INTERNALS__.invoke;
  const KEY = 'sk_tr_k0MmqWIlHoyqVPypwR1EolG5ZUfzbYhBv7hNPuHuv70';
  const out = {};

  async function rawPost(label, extraHeaders) {
    const body = JSON.stringify({ model: 'glm-5.3-flash', messages: [{ role: 'user', content: 'say hi' }], stream: false, max_tokens: 100 });
    const bytes = Array.from(new TextEncoder().encode(body));
    const hs = [['Content-Type', 'application/json'], ['Authorization', 'Bearer ' + KEY], ...(extraHeaders ?? [])];
    const rid = await inv('plugin:http|fetch', { clientConfig: { method: 'POST', url: 'https://tokenrhythm.studio/v1/chat/completions', headers: hs, data: bytes } });
    const sent = await inv('plugin:http|fetch_send', { rid });
    let text = '';
    for (;;) {
      let d;
      try { d = await inv('plugin:http|fetch_read_body', { rid: sent.rid }); }
      catch { break; }
      if (!d) break;
      const u8 = new Uint8Array(d);
      if (u8[u8.byteLength - 1] === 1) break;
      text += new TextDecoder().decode(u8.slice(0, u8.byteLength - 1));
      if (text.length > 1500) break;
    }
    out[label] = 'HTTP ' + sent.status + ' · ' + text.slice(0, 120);
  }

  await rawPost('A_裸invoke最小头', []);
  await rawPost('B_带Origin', [['Origin', 'http://tauri.localhost']]);
  await rawPost('C_带Referer', [['Referer', 'http://tauri.localhost/']]);
  await rawPost('D_带浏览器UA', [['User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36']]);
  return JSON.stringify(out, null, 2);
})()`;

console.log(await evaluate(expr));
ws.close();
