# Zego Token 生成器

一个用于生成 Zego Token Web 应用程序。一般是用于开发时期方便调试时使用

## 功能特点

- 生成带权限验证的token
- 生成基础token
- 安全配置 App ID 和 Server Secret
- LDAP 认证以确保安全访问
- token历史记录跟踪和管理
- 一键复制token到剪贴板
- 响应式设计，适配各种屏幕尺寸

## 项目结构

```
.
├── conf/                  # 配置文件
│   ├── env.conf           # 环境配置（App ID 和 Server Secret）
│   └── token-history.json # token历史记录存储
├── page/                  # HTML 页面
│   └── login.html         # 登录页面
├── server/                # 服务器端代码
│   ├── server.js          # 主服务器实现
│   ├── start-server.js    # 服务器启动脚本
│   ├── tokenHistory.js    # token历史记录管理
│   ├── zegoServerAssistant.js  # token生成工具
│   └── zegoServerAssistant.ts  # token工具的 TypeScript 版本
├── style/                 # CSS 样式表
│   ├── styles.css         # 主应用程序样式
│   └── login-styles.css   # 登录页面样式
├── index.html             # 主应用程序页面
├── package.json           # 项目依赖和脚本
├── package-lock.json      # 依赖锁定文件
└── test-api.js            # API 测试工具
```

## 前提条件

- Node.js（v14 或更高版本）
- npm（v6 或更高版本）

## 安装

1. 克隆仓库：
   ```
   git clone https://github.com/yourusername/zego-token-generator.git
   cd zego-token-generator
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 配置应用程序：
   - 创建 `conf/env.conf` 文件，包含您的 App ID 和 Server Secret（如果文件不存在，首次运行时会自动创建）

## 使用方法

1. 启动服务器：
   ```
   npm start
   ```

2. 打开浏览器并导航至：
   ```
   http://localhost:3000
   ```

3. 使用您的 LDAP 凭据登录

4. 如果尚未设置，请配置您的 App ID 和 Server Secret

5. 通过填写必要的字段并点击"生成"或"生成基础token"来生成token

## API 端点

- `POST /generate-token`：生成带有负载的token
- `POST /generate-basic-token`：生成带有空负载的基础token
- `POST /save-config`：保存配置
- `GET /get-config`：获取配置
- `GET /get-token-history`：获取token历史记录
- `POST /api/login`：使用 LDAP 凭据登录
- `POST /api/logout`：登出并清除会话
- `POST /api/clear-cookies`：清除所有 cookie
- `GET /api/check-login-status`：检查用户是否已登录

## 安全特性

- LDAP 认证以确保安全访问
- App ID 和 Server Secret 的安全存储
- 会话管理，自动登出
- 无硬编码凭据
- 敏感信息的 Base64 编码

## 开发

要在开发模式下运行应用程序：

```
npm run dev
```

这将同时启动主服务器和 API 服务器。

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

## 致谢

- 感谢 Zego 提供token生成 SDK
- 感谢 Express.js 提供 Web 服务器框架
- 感谢所有帮助改进此工具的贡献者
