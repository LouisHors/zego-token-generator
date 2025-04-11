# Zego Token Generator

A web application for generating authentication tokens for Zego services. This tool provides a user-friendly interface for creating and managing tokens with various permissions and configurations.

## Features

- Generate tokens with customizable parameters
- Create basic tokens with empty payload
- Configure App ID and Server Secret securely

- Token history tracking and management
- Copy tokens to clipboard with one click
- Responsive design for various screen sizes

## Project Structure

```
.
├── conf/                  # Configuration files
│   ├── env.conf           # Environment configuration (App ID and Server Secret)
│   └── token-history.json # Token history storage
├── page/                  # HTML pages
├── server/                # Server-side code
│   ├── server.js          # Main server implementation
│   ├── start-server.js    # Server startup script
│   ├── tokenHistory.js    # Token history management
│   ├── zegoServerAssistant.js  # Token generation utilities
│   └── zegoServerAssistant.ts  # TypeScript version of token utilities
├── style/                 # CSS stylesheets
│   └── styles.css         # Main application styles
├── index.html             # Main application page
├── package.json           # Project dependencies and scripts
├── package-lock.json      # Dependency lock file
└── test-api.js            # API testing utilities
```

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/zego-token-generator.git
   cd zego-token-generator
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure the application:
   - Create a `conf/env.conf` file with your App ID and Server Secret (this will be created automatically on first run if it doesn't exist)

## Usage

1. Start the server:
   ```
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```



3. Configure your App ID and Server Secret if not already set

4. Generate tokens by filling in the required fields and clicking "Generate" or "Generate Basic Token"

## API Endpoints

- `POST /generate-token`: Generate token with payload
- `POST /generate-basic-token`: Generate basic token with empty payload
- `POST /save-config`: Save configuration
- `GET /get-config`: Get configuration
- `GET /get-token-history`: Get token history


## Security Features

- Secure storage of App ID and Server Secret
- No hardcoded credentials
- Base64 encoding of sensitive information

## Development

To run the application in development mode:

```
npm run dev
```

This will start both the main server and API server concurrently.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Zego for providing the token generation SDK
- Express.js for the web server framework
- All contributors who have helped improve this tool
