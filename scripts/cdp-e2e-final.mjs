/* 最终 E2E：填配置 → 测试连接 → 返回 → 生成 → 读结果（修复后应全绿） */
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
function send(method, params) {
  return new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, silent: true });
  if (r.result?.exceptionDetails) return 'EXCEPTION: ' + String(r.result.exceptionDetails.exception?.description ?? '').slice(0, 800);
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SET_INPUT = `(el, v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`;

// 打开设置页
console.log('打开设置:', await evaluate(`(() => { const av = document.querySelector('.avatar'); if (av) { av.click(); return 'ok'; } return 'no-avatar'; })()`));
await sleep(800);

// 填配置
console.log('填配置:', await evaluate(`(() => {
  const set = ${SET_INPUT};
  const inputs = document.querySelectorAll('.settings-page input');
  set(inputs[0], 'https://tokenrhythm.studio/v1');
  set(inputs[1], 'sk_tr_k0MmqWIlHoyqVPypwR1EolG5ZUfzbYhBv7hNPuHuv70');
  set(inputs[2], 'glm-5.3-flash');
  return 'ok';
})()`));
await sleep(500);

// 测试连接
await evaluate(`(() => { const btn = Array.from(document.querySelectorAll('.settings-page button')).find((b) => b.textContent.includes('测试连接')); if (btn) btn.click(); return 'clicked'; })()`);
for (let i = 0; i < 15; i++) {
  await sleep(1000);
  const probe = await evaluate(`(() => {
    const el = Array.from(document.querySelectorAll('.settings-page span')).find((s) => /连接|HTTP|超时|无效|密钥/.test(s.textContent));
    return el ? el.textContent.trim() : null;
  })()`);
  if (probe) { console.log('测试连接:', probe); break; }
}

// 返回编辑页
await evaluate(`(() => { const btn = Array.from(document.querySelectorAll('button')).find((b) => /返回|←/.test(b.textContent)); if (btn) btn.click(); return 'ok'; })()`);
await sleep(800);

// 输入开头 + 生成
console.log('生成:', await evaluate(`(() => {
  const ta = document.querySelector('.user-input');
  if (!ta) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '夜深了，城市的霓虹灯');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('写下这段并续写'));
  if (!btn) return 'no-gen-btn';
  btn.click();
  return 'started';
})()`));

let finalState = null;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  finalState = await evaluate(`(() => {
    const errs = document.querySelector('.error-card');
    const cards = document.querySelectorAll('.candidate-card').length;
    const red = document.querySelector('.story-text .red');
    return JSON.stringify({ error: errs ? errs.textContent.trim().slice(0, 200) : null, candidates: cards, redLen: red ? red.textContent.length : 0 });
  })()`);
  const st = JSON.parse(finalState);
  if (st.error || st.candidates > 0) break;
}
console.log('结果:', finalState);
ws.close();
process.exit(0);
