/**
 * 本地模拟 OpenAI 服务器（阶段 3.5 §1③）。
 * 模拟器经 http://10.0.2.2:8787 访问宿主机；模型名决定场景：
 *   normal      正常流式输出
 *   reasoning   DeepSeek 风格：先 12 帧 reasoning 再正文
 *   empty       思考耗尽 max_tokens → finish_reason=length，正文为空
 *   slow        首字延迟 15 秒
 *   break       发一半直接断流
 *   err401/err404/err429  对应 HTTP 错误
 * 端口 8787。
 */
import http from 'node:http';

const PORT = 8787;
const MODELS = [{ id: 'normal' }, { id: 'reasoning' }, { id: 'empty' }, { id: 'slow' }, { id: 'break' }];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sseChunk(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

async function handleChat(req, res, body, url) {
  const model = body.model ?? 'normal';
  const wantsReasoning = /reasoning/i.test(model);

  if (model === 'err401') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
    return;
  }
  if (model === 'err404' || model === 'no-such-model') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `The model '${model}' does not exist` } }));
    return;
  }
  if (model === 'err429') {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Rate limit reached for requests' } }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const mk = (delta, extra = {}) => ({
    id: 'chatcmpl-mock',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model,
    choices: [{ index: 0, delta, finish_reason: null }],
    ...extra,
  });

  if (model === 'slow') {
    await sleep(15000);
  }
  if (model === 'reasoning' || model === 'empty' || wantsReasoning) {
    // DeepSeek 风格：先推理后正文
    const reasoningText = '用户想要续写一段雨夜故事。我先确定叙事视角：第一人称，悬疑基调。然后承接「雨还在下」的意象，引入全息广告牌与义肢的赛博朋克元素。节奏上短句开场，长句铺陈。';
    const chars = [...reasoningText];
    for (let i = 0; i < chars.length; i += 8) {
      if (res.destroyed) return;
      sseChunk(res, mk({ reasoning_content: chars.slice(i, i + 8).join('') }));
      await sleep(120);
    }
  }
  if (model === 'empty') {
    // 思考耗尽 max_tokens：无正文直接 length
    sseChunk(res, mk({}, { choices: [{ index: 0, delta: {}, finish_reason: 'length' }] }));
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  if (model === 'break') {
    // 发一半断流：不结束、直接销毁连接
    sseChunk(res, mk({ content: '凌晨三点，雨还在' }));
    await sleep(200);
    res.destroy();
    return;
  }

  // 正文流式输出
  const text =
    model === 'slow'
      ? '十五秒后，雨小了。她终于开口：你迟到了。'
      : '凌晨三点，雨还在下。霓虹在积水里碎成一片一片。我推开酒吧的后门，顺着排水沟走进巷子深处。有人跟了我三条街，脚步声和雨声混在一起，分不清。';
  const chunks = text.match(/.{1,6}/g) ?? [];
  for (const part of chunks) {
    if (res.destroyed) return;
    sseChunk(res, mk({ content: part }));
    await sleep(150);
  }
  sseChunk(res, mk({}, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    console.log(`[mock] ${req.method} ${req.url}`);
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: MODELS }));
      return;
    }
    if (req.url?.includes('/chat/completions')) {
      let body = {};
      try { body = JSON.parse(raw); } catch { /* ignore */ }
      void handleChat(req, res, body, req.url);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`mock openai on :${PORT}`));
