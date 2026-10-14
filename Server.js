const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;
const filesDirectory = path.join(__dirname, 'stored_files');

const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let bodySize = 0;
  let tooLarge = false;

  req.on('data', (chunk) => {
    bodySize += chunk.length;
    if (bodySize > 1024 * 1024) tooLarge = true;
    else chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) {
      return reject(new Error('Request body is too large'));
    }

    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(new Error('Invalid JSON'));
    }
  });
  req.on('error', reject);
});

const isSafeFilename = (filename) => (
  typeof filename === 'string'&& filename.trim() === filename && filename.length > 0&& filename !== '.'&&filename !== '..'&& !/[\\/<>:"|?*\0]/.test(filename)
);

const serveStaticFile = (res, filename, contentType) => {
  fs.readFile(path.join(__dirname, filename), (error, data) => {
    if (error) {
      return sendJSON(res, 500, { error: 'Could not load the requested page.' });
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname === '/') {
    return serveStaticFile(res, 'index.html', 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && requestUrl.pathname === '/Style.css') {
    return serveStaticFile(res, 'Style.css', 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && requestUrl.pathname === '/Script.js') {
    return serveStaticFile(res, 'Script.js', 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/files') {
    try {
      const filenames = await fs.promises.readdir(filesDirectory).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      return sendJSON(res, 200, { files: filenames });
    } catch {
      return sendJSON(res, 500, { error: 'Could not list saved files.' });
    }
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/files') {
    let file;
    try {
      file = await readBody(req);
    } catch (error) {
      const status = error.message === 'Request body is too large' ? 413 : 400;
      return sendJSON(res, status, { error: error.message });
    }

    const filename = file && file.filename;
    const content = file && file.content;
    if (!isSafeFilename(filename) || typeof content !== 'string') {
      return sendJSON(res, 400, { error: 'Enter a valid filename and text content.' });
    }

    try {
      await fs.promises.mkdir(filesDirectory, { recursive: true });
      await fs.promises.writeFile(path.join(filesDirectory, filename), content, 'utf8');
      return sendJSON(res, 201, {
        message: 'File saved successfully.',
        file: { filename, content },
      });
    } catch {
      return sendJSON(res, 500, { error: 'Could not save the file.' });
    }
  }

  const fileMatch = req.method === 'GET' && requestUrl.pathname.match(/^\/api\/files\/([^/]+)$/);
  if (fileMatch) {
    let filename;
    try {
      filename = decodeURIComponent(fileMatch[1]);
    } catch {
      return sendJSON(res, 400, { error: 'Invalid filename.' });
    }

    if (!isSafeFilename(filename)) {
      return sendJSON(res, 400, { error: 'Invalid filename.' });
    }

    try {
      const content = await fs.promises.readFile(path.join(filesDirectory, filename), 'utf8');
      return sendJSON(res, 200, { file: { filename, content } });
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      return sendJSON(res, status, {
        error: status === 404 ? 'File not found.' : 'Could not read the file.',
      });
    }
  }

  sendJSON(res, 404, { error: 'Not found.' });
});

server.listen(port, () => {
  console.log(`Mini file Manager: http://localhost:${port}`);
});
