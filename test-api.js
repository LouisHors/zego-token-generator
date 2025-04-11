const fetch = require('node-fetch');

// 配置
const BASE_URL = 'http://localhost:3000';
const TEST_APP_ID = '2024983255';
const TEST_SERVER_SECRET = '7e39ce51a1c447ff4eeeacd34c54177c';
const TEST_USER_ID = 'testuser123';
const TEST_ROOM_ID = 'testroom456';
const TEST_STREAM_ID = 'teststream789';
const TEST_USERNAME = 'your_test_username'; // 替换为有效的测试用户名
const TEST_PASSWORD = 'your_test_password'; // 替换为有效的测试密码

/**
 * 通用的 API 测试函数
 * @param {string} method - HTTP 方法 (GET, POST 等)
 * @param {string} endpoint - API 端点
 * @param {Object} [body] - 请求体
 * @returns {Promise<Object>} 响应数据
 */
async function testApi(method, endpoint, body = null) {
    try {
        console.log(`Testing ${method} ${endpoint}...`);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);

        console.log(`Status: ${response.status} ${response.statusText}`);

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        console.log('Response:', data);
        return data;
    } catch (error) {
        console.error(`Error testing ${method} ${endpoint}:`, error);
        return null;
    }
}

/**
 * 测试获取配置
 */
async function testGetConfig() {
    return testApi('GET', '/get-config');
}

/**
 * 测试保存配置
 */
async function testSaveConfig() {
    return testApi('POST', '/save-config', {
        appID: TEST_APP_ID,
        serverSecret: TEST_SERVER_SECRET,
    });
}

/**
 * 测试生成普通 Token
 */
async function testGenerateToken() {
    return testApi('POST', '/generate-token', {
        userId: TEST_USER_ID,
        roomId: TEST_ROOM_ID,
        streamId: TEST_STREAM_ID,
        allowPublish: 1,
        allowPlay: 1,
        expireTime: 3600,
    });
}

/**
 * 测试生成基础 Token
 */
async function testGenerateBasicToken() {
    return testApi('POST', '/generate-basic-token', {
        userId: TEST_USER_ID,
        roomId: TEST_ROOM_ID,
        streamId: TEST_STREAM_ID,
        allowPublish: 1,
        allowPlay: 1,
        expireTime: 3600,
    });
}

/**
 * 测试登录
 */
async function testLogin() {
    return testApi('POST', '/api/login', {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
    });
}

/**
 * 测试登出
 */
async function testLogout() {
    return testApi('POST', '/api/logout');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('=== 测试登录 ===');
    await testLogin();
    console.log('\n');

    console.log('=== 测试获取配置 ===');
    await testGetConfig();
    console.log('\n');

    console.log('=== 测试保存配置 ===');
    await testSaveConfig();
    console.log('\n');

    console.log('=== 再次测试获取配置 ===');
    await testGetConfig();
    console.log('\n');

    console.log('=== 测试生成普通 Token ===');
    await testGenerateToken();
    console.log('\n');

    console.log('=== 测试生成基础 Token ===');
    await testGenerateBasicToken();
    console.log('\n');

    console.log('=== 测试登出 ===');
    await testLogout();
    console.log('\n');
}

/**
 * 根据命令行参数运行指定的测试
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // 没有参数，运行所有测试
        await runAllTests();
    } else {
        // 根据参数运行指定的测试
        for (const arg of args) {
            switch (arg) {
                case 'get-config':
                    await testGetConfig();
                    break;
                case 'save-config':
                    await testSaveConfig();
                    break;
                case 'generate-token':
                    await testGenerateToken();
                    break;
                case 'generate-basic-token':
                    await testGenerateBasicToken();
                    break;
                case 'login':
                    await testLogin();
                    break;
                case 'logout':
                    await testLogout();
                    break;
                default:
                    console.error(`Unknown test: ${arg}`);
            }
        }
    }
}

main();
