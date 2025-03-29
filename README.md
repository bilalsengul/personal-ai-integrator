# Personal AI Integrator

A tool that simultaneously queries multiple AI platforms (Claude, OpenAI, and Gemini) using browser automation.

## Features

- Log in to Claude, OpenAI, and Gemini using your Google account
- Submit the same question to all three platforms simultaneously
- Display responses from all three AIs side by side
- Uses browser automation instead of APIs (avoiding API costs and limitations)
- Works with your existing subscriptions
- **NEW!** Response caching to avoid repeated queries
- **NEW!** Automatic retry mechanism for improved reliability
- **NEW!** Response comparison to highlight differences between AI platforms
- **NEW!** Screenshots for debugging login and response issues
- **NEW!** Colorized terminal output for better readability
- **NEW!** Configurable headless mode for background operation

## Prerequisites

- Node.js (v14 or newer)
- Valid Google account connected to all three AI platforms:
  - Claude (Anthropic)
  - OpenAI (with access to o3-mini-high)
  - Gemini (Google)
- You must have previously set up accounts on each platform and connected them to your Google account

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/bilalsengul/personal-ai-integrator.git
   cd personal-ai-integrator
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file from the example:
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file to add your Google credentials:
   ```
   GOOGLE_EMAIL=your_google_email
   GOOGLE_PASSWORD=your_google_password
   ```

## Configuration Options

Edit the `.env` file to customize application behavior:

```
# Toggle headless mode (true/false)
HEADLESS=false

# Record browser session videos for debugging (true/false)
RECORD_VIDEO=false 

# Default timeout in milliseconds
DEFAULT_TIMEOUT=60000
```

## Usage

### Start the server:

```
npm start
```

### Run the client in a separate terminal:

```
npm run client
```

### Client Commands

The client now supports several commands:

- `ask <question>` - Ask all AI platforms a question
- `compare` - Compare differences between the last responses
- `clear` - Clear the screen
- `help` - Show available commands
- `exit` - Exit the program

You can also just type your question directly without any command prefix.

## How It Works

The system uses Playwright to automate browser interactions with each AI platform. When you submit a question:

1. The system launches browser sessions for each platform
2. Logs in using your Google account on all platforms
3. Submits your question
4. Waits for and captures the responses
5. Returns all three responses
6. Caches responses to avoid duplicate queries
7. Compares responses to highlight differences in length, content, and format

## Troubleshooting

- If Google login fails, ensure your credentials in the `.env` file are correct
- Google may require additional verification steps the first time you use this tool
- If verification is required, the tool will pause for 120 seconds to allow manual verification
- Check the screenshots directory for visual debugging information
- If using headless mode, set `HEADLESS=false` temporarily to debug login issues
- Review video recordings in the videos directory if `RECORD_VIDEO=true`

## Disclaimer

This tool is for personal use only. Please ensure you comply with the terms of service of each AI platform.

## License

ISC
