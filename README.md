# Personal AI Integrator

A tool that simultaneously queries multiple AI platforms (Claude, OpenAI, and Gemini) using browser automation.

## Features

- Log in to Claude, OpenAI, and Gemini using your Google account
- Submit the same question to all three platforms simultaneously
- Display responses from all three AIs side by side
- Uses browser automation instead of APIs (avoiding API costs and limitations)
- Works with your existing subscriptions

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
   git clone https://github.com/yourusername/personal-ai-integrator.git
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

## Usage

### Start the server:

```
npm start
```

### Run the client in a separate terminal:

```
npm run client
```

The client will prompt you to enter a question, which will be sent to all three AI platforms. After a few moments, you'll see the responses from all platforms.

## How It Works

The system uses Playwright to automate browser interactions with each AI platform. When you submit a question:

1. The system launches browser sessions for each platform
2. Logs in using your Google account on all platforms
3. Submits your question
4. Waits for and captures the responses
5. Returns all three responses

## Troubleshooting

- If Google login fails, ensure your credentials in the `.env` file are correct
- Google may require additional verification steps the first time you use this tool
- If verification is required, the tool will pause for 15 seconds to allow manual verification
- The selectors used for interacting with web elements might break if the platforms change their UI
- Ensure you have a stable internet connection

## Disclaimer

This tool is for personal use only. Please ensure you comply with the terms of service of each AI platform.

## License

ISC