// server.js
console.log('Starting server/server.js...');

const express = require('express');
console.log('Express loaded');

const path = require('path'); // 用于处理文件路径
console.log('Path loaded');

const fs = require('fs'); // 用于文件读写
console.log('FS loaded');

const { generateToken04, getPlainText } = require('./zegoServerAssistant'); // 引入Token生成函数
console.log('Token generator loaded');

const { addTokenToHistory, getTokenHistoryByAppID, getAllTokenHistory } = require('./tokenHistory'); // 引入Token历史记录管理
console.log('Token history manager loaded');

const session = require('express-session'); // 用于会话管理
console.log('Session loaded');

// --- Upstash Redis / Session Store Integration --- Start ---
const { Redis } = require('@upstash/redis');
// const connectRedis = require("connect-redis"); // Require the main function
// const RedisStore = connectRedis(session); // Pass session to get the store constructor - Incorrect!
const { RedisStore } = require("connect-redis"); // Attempt named import using destructuring
console.log('Upstash Redis and connect-redis loaded, attempting to use named RedisStore export.'); // Updated log

// Initialize Upstash Redis client from environment variables
// Vercel automatically sets UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN when connected
let redisClient;
try {
    redisClient = Redis.fromEnv();
    console.log('Upstash Redis client initialized using Redis.fromEnv()');
} catch (error) {
    console.error('ERROR: Failed to initialize Upstash Redis client from environment variables.');
    console.error('Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set correctly in Vercel.');
    console.error(error);
    // Depending on requirements, might want to exit or use fallback
    // process.exit(1);
}
// --- Upstash Redis / Session Store Integration --- End ---

// 引入认证模块
const { authMiddleware, router: authRouter } = require('./auth');
console.log('Auth module loaded');

const app = express();
const port = process.env.PORT || 3000; // Use PORT from env if available
console.log(`Express app created. Attempting to listen on port: ${port}`);

// --- 默认配置 ---
// 不再硬编码 appID 和 serverSecret
// appID 和 serverSecret 将从配置文件中读取
const DEFAULT_EXPIRE_TIME = 120; // 默认 Token 有效期，单位秒
const CONFIG_FILE_PATH = path.join(__dirname, '../conf/env.conf'); // 配置文件路径
// OPT_OMS_LOGIN_URL 和 token_map 已移至 auth.js
const SESSION_SECRET = process.env.SESSION_SECRET || 'zego-token-generator-secret-fallback'; // 从环境变量读取，提供回退
if (SESSION_SECRET === 'zego-token-generator-secret-fallback') {
    console.warn('WARNING: Using fallback SESSION_SECRET. Set SESSION_SECRET environment variable in production!');
}
// --- 配置结束 ---

// --- Vercel KV Session Store --- Start ---
// Removed - Replaced by Upstash Redis Integration above
// --- Vercel KV Session Store --- End ---

// 加密和解密函数
function encodeConfig(appID, serverSecret) {
    const configStr = JSON.stringify({ appID, serverSecret });
    return Buffer.from(configStr).toString('base64');
}

function decodeConfig(encodedConfig) {
    try {
        const configStr = Buffer.from(encodedConfig, 'base64').toString('utf8');
        return JSON.parse(configStr);
    } catch (error) {
        console.error('Error decoding config:', error);
        return null;
    }
}

// 读取配置
function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const encodedConfig = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
            return decodeConfig(encodedConfig);
        } else {
            console.warn(`Config file not found at ${CONFIG_FILE_PATH}`);
        }
    } catch (error) {
        console.error('Error reading config file:', error);
    }
    return null;
}

// 写入配置
function writeConfig(appID, serverSecret) {
    try {
        console.log(`Writing config to ${CONFIG_FILE_PATH}...`);
        const encodedConfig = encodeConfig(appID, serverSecret);
        console.log('Config encoded successfully');
        // 确保目录存在
        const confDir = path.dirname(CONFIG_FILE_PATH);
        if (!fs.existsSync(confDir)) {
            fs.mkdirSync(confDir, { recursive: true });
            console.log(`Created directory: ${confDir}`);
        }
        fs.writeFileSync(CONFIG_FILE_PATH, encodedConfig, 'utf8');
        console.log('Config file written successfully');
        return true;
    } catch (error) {
        console.error('Error writing config file:', error);
        return false;
    }
}

// 中间件，用于解析 JSON 请求体
app.use(express.json());
console.log('express.json middleware added.');

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - Incoming Request: ${req.method} ${req.originalUrl}`);
    next();
});

// 配置会话中间件 - 必须在 authMiddleware 和 authRouter 之前
console.log('Configuring express-session middleware...');
if (redisClient) { // Only configure session if Redis client initialized successfully
    app.use(session({
        store: new RedisStore({
            client: redisClient,
            prefix: "sess:" // Optional: prefix for session keys in Redis
        }),
        secret: SESSION_SECRET, // Read from env or fallback
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // 在生产环境中应使用 secure cookie
            httpOnly: true, // 防止客户端脚本访问 cookie
            // 不设置 maxAge，使用默认的会话 cookie，关闭浏览器后失效
            // maxAge: 1000 * 60 * 60 * 24 // Example: 1 day session lifetime
        }
    }));
    console.log('express-session middleware configured using RedisStore.');
} else {
    console.error('ERROR: Redis client not available, express-session middleware NOT configured.');
    // Handle this case - maybe prevent server start or use MemoryStore as fallback with warning
    console.warn('WARNING: Falling back to MemoryStore for session due to Redis client init failure. Sessions will not persist across restarts/deployments!');
    app.use(session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        }
    }));
    console.log('express-session middleware configured using MemoryStore (Fallback).');
}

// 提供静态文件服务 (托管 public 目录下的文件，用于本地开发)
console.log('Configuring express.static middleware for local development...');
app.use(express.static(path.join(__dirname, '../public')));
console.log('express.static middleware configured.');

// --- 认证路由和中间件 ---
console.log('Mounting authentication router...');
app.use(authRouter); // 使用从 auth.js 导入的路由
console.log('Authentication router mounted.');

console.log('Applying authentication middleware...');
app.use(authMiddleware);
console.log('Authentication middleware applied.');
// --- 认证结束 ---

// --- 受保护的 API 路由 ---
console.log('Defining protected API routes...');

// API 路由：保存配置
app.post('/save-config', (req, res) => {
    const { appID, serverSecret } = req.body;

    // 校验 appID 和 serverSecret
    if (!appID || isNaN(parseInt(appID, 10))) {
        return res.status(400).json({ error: 'App ID must be a valid number' });
    }

    if (!serverSecret || typeof serverSecret !== 'string' || serverSecret.length !== 32 || !/^[a-zA-Z0-9]+$/.test(serverSecret)) {
        return res.status(400).json({ error: 'Server Secret must be a 32-character alphanumeric string' });
    }

    // 尝试写入配置文件
    const success = writeConfig(appID, serverSecret);

    if (success) {
        res.json({ success: true, message: 'Configuration saved successfully' });
    } else {
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// API 路由：获取配置
app.get('/get-config', (req, res) => {
    const config = readConfig();

    if (config) {
        res.json({ success: true, appID: config.appID });
    } else {
        res.json({ success: false, message: 'No configuration found' });
    }
});

// API 路由：生成 Token
app.post('/generate-token', (req, res) => {
    const { userId, roomId, streamId, allowPublish, allowPlay, expireTime } = req.body;

    // 从配置文件中读取 appID 和 serverSecret
    const config = readConfig();
    if (!config) {
        return res.status(400).json({ error: 'Configuration not found. Please configure App ID and Server Secret first.' });
    }

    const { appID, serverSecret } = config;

    // 基本的数据校验 (可以根据需要添加更严格的校验)
    if (!userId || !roomId || !streamId || allowPublish === undefined || allowPlay === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 校验 userId, roomId, streamId 格式 (字母和数字)
    const pattern = /^[a-zA-Z0-9]+$/;
    if (!pattern.test(userId) || !pattern.test(roomId) || !pattern.test(streamId)) {
        return res.status(400).json({ error: 'User ID, Room ID, and Stream ID must be alphanumeric' });
    }

    // 校验 expireTime
    // 确保 expireTime 是数字类型
    let tokenExpireTime = DEFAULT_EXPIRE_TIME;

    if (expireTime !== undefined) {
        const parsedExpireTime = parseInt(expireTime, 10);
        console.log('Parsed expireTime:', parsedExpireTime);
        if (!isNaN(parsedExpireTime) && parsedExpireTime >= 60) {
            tokenExpireTime = parsedExpireTime;
        }
    }

    console.log('Token generation - expireTime input:', expireTime);
    console.log('Token generation - using expireTime:', tokenExpireTime);

    // 构建 payload
    const payloadObject = {
        room_id: roomId,
        privilege: {
            1: 1, // 允许登录房间 (固定为允许)
            2: Number(allowPublish) || 0, // 允许推流权限 (来自前端)
            3: Number(allowPlay) || 0, // 允许拉流权限 (来自前端)
        },
        stream_id_list: streamId ? [streamId] : null // 如果提供了 streamId，则加入列表
    };
    const payload = JSON.stringify(payloadObject);

    try {
        // 调用 Token 生成函数
        // 将 appID 转换为数字
        const numericAppID = parseInt(appID, 10);
        const token = generateToken04(numericAppID, userId, serverSecret, tokenExpireTime, payload);
        console.log(`Generated token for user ${userId} in room ${roomId}: ${token}`);
        console.log(`Token expire time: ${tokenExpireTime} seconds`);

        // 获取 plainText 并将令牌添加到历史记录
        const plainText = getPlainText();
        addTokenToHistory(appID, token, plainText);

        // 返回生成的 Token
        res.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        // 如果 generateToken04 内部抛出错误 (如参数无效)
        const errorMessage = error.errorMessage || 'Failed to generate token due to an internal error.';
        const errorCode = error.errorCode || 500; // 使用内部错误码或通用 500
        // 根据错误码确定HTTP状态码，例如参数无效用400，其他用500
        const statusCode = (errorCode === 1 || errorCode === 3 || errorCode === 5 || errorCode === 6) ? 400 : 500;
        res.status(statusCode).json({ error: errorMessage });
    }
});

// API 路由：生成基础 Token（payload 为空字符串）
app.post('/generate-basic-token', (req, res) => {
    const { userId, roomId, allowPublish, allowPlay, expireTime } = req.body;

    // 从配置文件中读取 appID 和 serverSecret
    const config = readConfig();
    if (!config) {
        return res.status(400).json({ error: 'Configuration not found. Please configure App ID and Server Secret first.' });
    }

    const { appID, serverSecret } = config;

    // 基本的数据校验 (可以根据需要添加更严格的校验)
    // 基础token不需要校验 streamId
    if (!userId || !roomId || allowPublish === undefined || allowPlay === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 校验 userId, roomId 格式 (字母和数字)
    const pattern = /^[a-zA-Z0-9]+$/;
    if (!pattern.test(userId) || !pattern.test(roomId)) {
        return res.status(400).json({ error: 'User ID and Room ID must be alphanumeric' });
    }

    // 校验 expireTime
    // 确保 expireTime 是数字类型
    let tokenExpireTime = DEFAULT_EXPIRE_TIME;

    if (expireTime !== undefined) {
        const parsedExpireTime = parseInt(expireTime, 10);
        if (!isNaN(parsedExpireTime) && parsedExpireTime >= 60) {
            tokenExpireTime = parsedExpireTime;
        }
    }

    console.log('Basic token - expireTime input:', expireTime);
    console.log('Basic token - using expireTime:', tokenExpireTime);

    try {
        // 调用 Token 生成函数，payload 参数固定为空字符串
        // 将 appID 转换为数字
        const numericAppID = parseInt(appID, 10);
        const token = generateToken04(numericAppID, userId, serverSecret, tokenExpireTime, '');
        console.log(`Generated basic token for user ${userId} in room ${roomId}: ${token}`);
        console.log(`Basic token expire time: ${tokenExpireTime} seconds`);

        // 获取 plainText 并将令牌添加到历史记录
        const plainText = getPlainText();
        addTokenToHistory(appID, token, plainText);

        // 返回生成的 Token
        res.json({ token });
    } catch (error) {
        console.error('Error generating basic token:', error);
        // 如果 generateToken04 内部抛出错误 (如参数无效)
        const errorMessage = error.errorMessage || 'Failed to generate basic token due to an internal error.';
        const errorCode = error.errorCode || 500; // 使用内部错误码或通用 500
        // 根据错误码确定HTTP状态码，例如参数无效用400，其他用500
        const statusCode = (errorCode === 1 || errorCode === 3 || errorCode === 5 || errorCode === 6) ? 400 : 500;
        res.status(statusCode).json({ error: errorMessage });
    }
});

// API 路由：获取令牌历史记录
app.get('/get-token-history', (req, res) => {
    // 从配置文件中读取 appID
    const config = readConfig();
    if (!config) {
        return res.status(400).json({ error: 'Configuration not found. Please configure App ID and Server Secret first.' });
    }

    const { appID } = config;

    // 获取指定 appID 的令牌历史记录
    const tokenHistory = getTokenHistoryByAppID(appID);

    res.json({ success: true, appID, tokenHistory });
});

// Add back app.get('/') handler for local development
// Vercel's routing/filesystem handling will likely take precedence in production
app.get('/', (req, res) => {
    console.log('[server.js] GET / route hit (local handler)');
    // Note: Auth middleware runs before this handler on Vercel due to routes
    // Locally, auth middleware also runs first.
    // If authenticated, it should serve index.html.
    // If not, authMiddleware should redirect before this handler is reached.
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 添加错误处理中间件 - 必须放在最后
console.log('Adding final error handler middleware...');
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 启动服务器
console.log('Attempting to start server...');
try {
    // Vercel 会处理监听，本地运行时需要 app.listen
    if (process.env.VERCEL) {
        console.log('Running on Vercel, skipping app.listen()');
    } else {
        console.log(`Attempting app.listen on port ${port}`);
        const server = app.listen(port, () => {
            console.log(`Server listening locally at http://localhost:${port}`);
            console.log('Available endpoints (some require login):');
            console.log('- GET /login: Login page');
            console.log('- POST /api/login: Login with LDAP credentials');
            console.log('- POST /api/logout: Logout and clear session');
            console.log('- GET /api/check-login-status: Check if user is logged in');
            console.log('--- Protected Endpoints ---');
            console.log('- GET /: Main application page');
            console.log('- POST /generate-token: Generate token with payload');
            console.log('- POST /generate-basic-token: Generate basic token with empty payload');
            console.log('- POST /save-config: Save configuration');
            console.log('- GET /get-config: Get configuration');
            console.log('- GET /get-token-history: Get token history');
            // console.log('- POST /api/clear-cookies: Clear all cookies and session (for debugging)');
        });

        server.on('error', (error) => {
            console.error('Server error:', error);
            process.exit(1);
        });
    }
} catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
}

// Export the app for Vercel
module.exports = app;
console.log('Server setup complete. Exporting app.');
