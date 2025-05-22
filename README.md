# AWS Cognito Integration App

A Node.js Express application that integrates with AWS Cognito for user authentication using OpenID Connect.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AWS Cognito Settings

Replace the following placeholders in `app.js`:

- `REGION` - Your AWS region (e.g., `us-east-1`)
- `USER_POOL_ID` - Your Cognito User Pool ID
- `YOUR_CLIENT_ID` - Your App Client ID
- `YOUR_CLIENT_SECRET` - Your App Client Secret
- `YOUR_COGNITO_DOMAIN` - Your Cognito domain

### 3. Configure Cognito App Client

In AWS Cognito Console:
- **Callback URLs**: `http://localhost:3000/callback`
- **Sign out URLs**: `http://localhost:3000/`
- **OAuth Scopes**: `openid`, `email`, `profile`, `phone`

### 4. Run the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Visit: `http://localhost:3000`

## Environment Variables (Optional)

Create a `.env` file:
```
PORT=3000
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_DOMAIN=your_domain
SESSION_SECRET=your_session_secret
```

## Features

- ✅ OpenID Connect authentication
- ✅ Session management
- ✅ User info display
- ✅ Secure logout
- ✅ Error handling