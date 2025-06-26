# AI Pet Companion

A simple AI-powered virtual pet companion that you can chat with through a web interface.

**Live Demo:** http://ai-pet-companion-env.eba-mirmdfwa.us-east-2.elasticbeanstalk.com/

## Features

- Interactive chat interface with your AI pet
- Persistent pet state and memory
- Real-time responses powered by Google's AI models
- Simple web-based UI

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Create a `.env` file with your Google AI API key:
   ```
   GOOGLE_API_KEY=your_api_key_here
   ```

3. Start the development server:
   ```bash
   yarn dev
   ```

4. Open your browser to `http://localhost:3000`

## Usage

Simply type messages to your AI pet companion in the chat interface and watch it respond with personality!

## Scripts

- `yarn dev` - Start development server with auto-reload
- `yarn start` - Start production server

## Tech Stack

- Node.js + Express
- Google AI SDK
- Vanilla JavaScript frontend
- LowDB for state persistence
- Deployed on AWS Elastic Beanstalk