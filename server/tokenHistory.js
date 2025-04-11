// tokenHistory.js
// Manages token history storage by appID

const fs = require('fs');
const path = require('path');

// Path to the token history file
const TOKEN_HISTORY_FILE_PATH = path.join(__dirname, '..', 'conf', 'token-history.json');
const MAX_TOKENS_PER_APP_ID = 100;

/**
 * Read token history from file
 * @returns {Object} Token history object with appIDs as keys
 */
function readTokenHistory() {
    try {
        if (fs.existsSync(TOKEN_HISTORY_FILE_PATH)) {
            const historyData = fs.readFileSync(TOKEN_HISTORY_FILE_PATH, 'utf8');
            return JSON.parse(historyData);
        }
    } catch (error) {
        console.error('Error reading token history file:', error);
    }
    return {}; // Return empty object if file doesn't exist or there's an error
}

/**
 * Write token history to file
 * @param {Object} historyData Token history object
 * @returns {boolean} Success status
 */
function writeTokenHistory(historyData) {
    try {
        fs.writeFileSync(TOKEN_HISTORY_FILE_PATH, JSON.stringify(historyData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing token history file:', error);
        return false;
    }
}

/**
 * Add a token to history for a specific appID
 * @param {string} appID The application ID
 * @param {string} token The generated token
 * @param {string} plainText The plainText used to generate the token
 * @returns {boolean} Success status
 */
function addTokenToHistory(appID, token, plainText) {
    try {
        // Read current history
        const historyData = readTokenHistory();

        // Initialize array for this appID if it doesn't exist
        if (!historyData[appID]) {
            historyData[appID] = [];
        }

        // Add new token at the beginning of the array
        historyData[appID].unshift({
            token,
            plainText,
            timestamp: new Date().toISOString()
        });

        // Limit to MAX_TOKENS_PER_APP_ID tokens per appID
        if (historyData[appID].length > MAX_TOKENS_PER_APP_ID) {
            historyData[appID] = historyData[appID].slice(0, MAX_TOKENS_PER_APP_ID);
        }

        // Write updated history back to file
        return writeTokenHistory(historyData);
    } catch (error) {
        console.error('Error adding token to history:', error);
        return false;
    }
}

/**
 * Get token history for a specific appID
 * @param {string} appID The application ID
 * @returns {Array} Array of token history entries
 */
function getTokenHistoryByAppID(appID) {
    try {
        const historyData = readTokenHistory();
        return historyData[appID] || [];
    } catch (error) {
        console.error('Error getting token history:', error);
        return [];
    }
}

/**
 * Get all token history
 * @returns {Object} Token history object with appIDs as keys
 */
function getAllTokenHistory() {
    return readTokenHistory();
}

module.exports = {
    addTokenToHistory,
    getTokenHistoryByAppID,
    getAllTokenHistory
};
