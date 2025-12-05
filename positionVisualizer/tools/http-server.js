// Simple HTTP server for serving static files
// Used by positionVisualizer to serve HTML/CSS/JS files

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.HTTP_PORT || 8000);
const HOST = process.env.HTTP_HOST || '127.0.0.1';

// Get the directory containing this script, then go up one level to positionVisualizer
const toolsDir = __dirname;
const baseDir = path.resolve(toolsDir, '..');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    res.writeHead(200, { 
      'Content-Type': mimeType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Remove leading slash and resolve path
  const filePath = path.join(baseDir, pathname);
  
  // Security: ensure file is within baseDir
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(baseDir))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    serveFile(filePath, res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HTTP server listening on http://${HOST}:${PORT}`);
  console.log(`Serving files from: ${baseDir}`);
});

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Please close the application using port ${PORT} or set HTTP_PORT environment variable to use a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

