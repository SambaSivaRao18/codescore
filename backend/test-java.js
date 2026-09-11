const http = require('http');
const https = require('https');

const executorUrl = 'https://java-codescore.onrender.com/';
const code = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
`;
const stdin = '';
const timeoutMs = 2000;

const body = JSON.stringify({ code, stdin, timeoutMs });
const url = new URL('/execute', executorUrl);
const isHttps = url.protocol === 'https:';
const lib = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
  timeout: timeoutMs + 8000,
};

console.log('Options:', options);

const req = lib.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    try {
      console.log('Response:', JSON.parse(data));
    } catch (e) {
      console.log('Raw data:', data);
      console.log('Error parsing JSON:', e.message);
    }
  });
});

req.on('error', (err) => console.log('Req error:', err));
req.on('timeout', () => {
  req.destroy();
  console.log('Timeout');
});

req.write(body);
req.end();
