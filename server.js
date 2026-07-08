const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.ico' : 'image/x-icon',
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === '/' ? 'login.html' : req.url);
  const ext    = path.extname(filePath).toLowerCase();
  const mime   = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + req.url);
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });

}).listen(PORT, () => {
  console.log('Frontend running at http://localhost:' + PORT);
  console.log('Open: http://localhost:' + PORT + '/login.html');
});
