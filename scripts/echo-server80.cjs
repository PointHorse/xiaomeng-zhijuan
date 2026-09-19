/* 本地回显服务器：打印收到的请求行/头/体（诊断用，临时） */
const http = require('node:http');
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    console.log('=== ' + req.method + ' ' + req.url + ' ===');
    for (const [k, v] of Object.entries(req.headers)) console.log(`  ${k}: ${v}`);
    console.log('  body(' + body.length + '): ' + body.slice(0, 200));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true,"data":[]}');
  });
});
server.listen(80, '127.0.0.1', () => console.log('echo server on 127.0.0.1:80'));
setTimeout(() => process.exit(0), 60000);
