/* 复刻应用生成链路：3 条并发流式候选（温度抖动 -0.1/0/+0.1），SSE 解析与 src/provider/sse.ts 一致 */
const BASE = 'https://tokenrhythm.studio/v1';
const KEY = 'sk_tr_k0MmqWIlHoyqVPypwR1EolG5ZUfzbYhBv7hNPuHuv70';
const MODEL = process.argv[2] || 'glm-5.3-flash';
const INSTRUCTION = '直接续写下面的文本。不要解释，不要总结，只输出续写正文。';
const CONTEXT = '夜深了，城市的霓虹灯';

function extractDelta(json) {
  try {
    const obj = JSON.parse(json);
    const choices = obj.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const c0 = choices[0];
      const delta = c0.delta;
      if (delta && typeof delta.content === 'string') return delta.content;
      const msg = c0.message;
      if (msg && typeof msg.content === 'string') return msg.content;
      if (typeof c0.text === 'string') return c0.text;
      if (typeof c0.content === 'string') return c0.content;
    }
    const message = obj.message;
    if (message && typeof message.content === 'string') return message.content;
    return '';
  } catch { return ''; }
}

async function runOne(index) {
  const jitter = [0.8, 0.9, 1.0][index];
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: `${INSTRUCTION}\n${CONTEXT}` }],
        stream: true,
        temperature: jitter,
        top_p: 0.92,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { index, ok: false, error: `HTTP ${res.status} · ${body.slice(0, 160)}` };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', text = '', reasoningLen = 0, firstByteMs = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!firstByteMs) firstByteMs = Date.now() - t0;
      buf += decoder.decode(value, { stream: true });
      let idx;
      const lines = [];
      while ((idx = buf.indexOf('\n')) >= 0) { lines.push(buf.slice(0, idx).replace(/\r$/, '')); buf = buf.slice(idx + 1); }
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const p = t.slice(5).trim();
        if (p === '[DONE]') continue;
        try {
          const o = JSON.parse(p);
          const d = o.choices?.[0]?.delta ?? {};
          if (typeof d.reasoning_content === 'string') reasoningLen += d.reasoning_content.length;
          const delta = extractDelta(p);
          if (delta) text += delta;
        } catch { /* 与应用一致：坏帧静默跳过 */ }
      }
    }
    return { index, ok: text.trim().length > 0, firstByteMs, totalMs: Date.now() - t0, textLen: text.length, reasoningLen, preview: text.slice(0, 60) };
  } catch (e) {
    return { index, ok: false, error: e.message };
  }
}

(async () => {
  console.log(`模型: ${MODEL}，3 条并发流式…`);
  const results = await Promise.all([runOne(0), runOne(1), runOne(2)]);
  for (const r of results) {
    if (r.ok) console.log(`  候选${r.index}: ✓ ${r.textLen} 字 | 首字节 ${r.firstByteMs}ms | 总 ${r.totalMs}ms | 思考 ${r.reasoningLen} 字 | 「${r.preview}…」`);
    else console.log(`  候选${r.index}: ✗ ${r.error}`);
  }
})();
