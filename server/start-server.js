// start-server.js
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting server...');

// 启动服务器
const server = spawn('node', [path.join(__dirname, 'server.js')]);
console.log(`Server started with PID ${server.pid}`);

// 处理服务器的输出
server.stdout.on('data', (data) => {
    process.stdout.write(`${data}`);
});

server.stderr.on('data', (data) => {
    process.stderr.write(`ERROR: ${data}`);
});

// 处理服务器退出
server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
});

// 处理进程信号，确保优雅退出
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down server...');
    server.kill();
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Shutting down server...');
    server.kill();
});

console.log('\nServer started. Press Ctrl+C to stop.\n');
