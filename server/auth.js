// server/auth.js
console.log('Loading server/auth.js...');

const express = require('express');
const path = require('path');
const axios = require('axios');

// --- 常量 ---
const OPT_OMS_LOGIN_URL = "https://opt-oms.zego.cloud/OmsApi/api/v2/user/login"; // LDAP登录接口
const token_map = {}; // 用户令牌映射 (虽然定义了，但目前在 opt_oms_login 中没有实际写入或读取逻辑保留，可能需要根据后续需求调整)

// --- LDAP登录函数 ---
async function opt_oms_login(account, pwd) {
    let code = 0;
    const request_json = { "username": account, "password": pwd };
    console.log(`[auth.js] opt_oms_login called for user: ${account}`);

    try {
        console.log(`Attempting LDAP login for user: ${account}`);
        const response = await axios.post(OPT_OMS_LOGIN_URL, request_json, { validateStatus: false });
        const response_json = response.data;
        console.log(`LDAP response for user ${account}:`, response_json);


        if (response_json.code === 10000) {
            // 登录成功逻辑，如果需要存储 token，可以在这里处理 token_map
            const msg = response_json.message;
            console.log(`User ${account} logged in successfully via LDAP: ${msg}`);
        } else {
            // 登录失败逻辑
            code = response_json.code;
            const msg = response_json.message;
            console.log(`LDAP login failed for user ${account}: ${msg} (Code: ${code})`);
        }
    } catch (error) {
        console.error(`opt_oms_login function failed for user ${account}: ${error}`);
        code = -1; // 表示内部错误
    }

    console.log(`[auth.js] opt_oms_login finished for user: ${account}, returning code: ${code}`);
    return code;
}


// --- 身份验证中间件 ---
const authMiddleware = (req, res, next) => {
    console.log(`[auth.js] authMiddleware executing for: ${req.method} ${req.originalUrl}`);

    // 排除登录页面和登录API
    const publicPaths = ['/login.html', '/api/login', '/login'];
    if (publicPaths.includes(req.path)) {
        console.log(`[auth.js] Path ${req.path} is public, skipping auth check.`);
        return next();
    }

    // 检查用户是否已登录
    if (!req.session || !req.session.authenticated) {
        console.log(`[auth.js] Authentication failed for ${req.method} ${req.url}. Session authenticated: ${req.session ? req.session.authenticated : 'no session'}`);
        // 如果是API请求，返回401错误
        if (req.path.startsWith('/api/') || req.path.startsWith('/generate-') || req.path.startsWith('/save-config') || req.path.startsWith('/get-config')) {
            return res.status(401).json({ error: 'Unauthorized', message: '请先登录' });
        }
        // 如果是页面请求，重定向到登录页
        console.log(`[auth.js] Redirecting to /login.html`);
        return res.redirect('/login.html');
    }
    console.log(`[auth.js] Authentication successful for ${req.method} ${req.url}. User: ${req.session.username}`);
    next();
};


// --- 认证路由 ---
const router = express.Router();
console.log('[auth.js] Creating auth router...');

// Add back router.get('/login') handler for local development
// Vercel should serve public/login.html directly due to filesystem handling
router.get('/login', (req, res) => {
    console.log('[auth.js] GET /login route hit (local handler)');
    // This should only be hit locally if authMiddleware allows it (which it should)
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// LDAP登录API
router.post('/api/login', async (req, res) => {
    console.log('[auth.js] POST /api/login route hit');
    const { username, password } = req.body;

    // 基本验证
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    try {
        // 调用LDAP登录接口
        const code = await opt_oms_login(username, password);

        if (code === 0) {
            // 登录成功，设置会话
            req.session.authenticated = true;
            req.session.username = username;
            console.log(`[auth.js] Session set for user: ${username}, authenticated: ${req.session.authenticated}`);
            // 确保会话被保存
            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ success: false, message: '会话保存失败，请重试' });
                }
                return res.json({ success: true, message: '登录成功' });
            });
        } else {
            // 登录失败
            console.log(`Login failed for user: ${username}, LDAP code: ${code}`);
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
    } catch (error) {
        console.error('Login API error:', error);
        return res.status(500).json({ success: false, message: '登录服务暂时不可用，请稍后再试' });
    }
});

// 登出API
router.post('/api/logout', (req, res) => {
    console.log('[auth.js] POST /api/logout route hit');
    const username = req.session ? req.session.username : 'unknown user';
    req.session.destroy(err => {
        if (err) {
            console.error(`Logout error for user ${username}:`, err);
            return res.status(500).json({ success: false, message: '登出失败' });
        }
        // 清除所有相关的cookie
        res.clearCookie('connect.sid'); // 清除会话 cookie
        console.log(`User ${username} logged out successfully.`);
        res.json({ success: true, message: '已成功登出' });
    });
});

// 清除所有cookie API (主要是为了开发/调试，正常登出已包含清除)
router.post('/api/clear-cookies', (req, res) => {
    console.log('[auth.js] POST /api/clear-cookies route hit');
    const username = req.session ? req.session.username : 'unknown user';
    req.session.destroy(err => {
        if (err) {
            console.error(`Error destroying session during clear-cookies for ${username}:`, err);
        }
        // 清除所有相关的cookie
        res.clearCookie('connect.sid'); // 清除会话 cookie
        console.log(`Cookies and session cleared for ${username} via /api/clear-cookies.`);
        res.json({ success: true, message: '已清除所有cookie和会话' }); // 消息更精确
    });
});


// 检查登录状态 API
router.get('/api/check-login-status', (req, res) => {
    console.log('[auth.js] GET /api/check-login-status route hit');
    // 检查用户是否已登录
    if (req.session && req.session.authenticated) {
        // 已登录
        console.log(`Login status check: User ${req.session.username} is logged in.`);
        res.json({ success: true, message: '用户已登录', username: req.session.username });
    } else {
        // 未登录
        console.log(`Login status check: User is not logged in. Session authenticated: ${req.session ? req.session.authenticated : 'no session'}`);
        res.status(401).json({ success: false, message: '用户未登录' });
    }
});


// --- 导出 ---
console.log('[auth.js] Exporting authMiddleware and router...');
module.exports = {
    authMiddleware,
    router // 导出路由对象
};
