// server.js
console.log('Starting server...');

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

const app = express();
const port = 3000; // 您可以选择其他端口

// --- 默认配置 ---
// 不再硬编码 appID 和 serverSecret
// appID 和 serverSecret 将从配置文件中读取
const DEFAULT_EXPIRE_TIME = 120; // 默认 Token 有效期，单位秒
const CONFIG_FILE_PATH = path.join(__dirname, '../conf/env.conf'); // 配置文件路径
// --- 配置结束 ---

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

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// 提供静态文件服务 (托管 index.html)
app.use(express.static(path.join(__dirname, '..'))); // 静态文件服务指向项目根目录

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

// 根路由，提供 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
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

// 添加错误处理中间件 - 必须放在最后
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 启动服务器
try {
    const server = app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
        console.log('Available endpoints:');
        console.log('- POST /generate-token: Generate token with payload');
        console.log('- POST /generate-basic-token: Generate basic token with empty payload');
        console.log('- POST /save-config: Save configuration');
        console.log('- GET /get-config: Get configuration');
        console.log('- GET /get-token-history: Get token history');
    });

    server.on('error', (error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
} catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
}
