# Chat System Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## 3. Firebase

Create a Firebase project and enable:

- Firestore Database
- Authentication
- Anonymous sign-in

Recommended Firestore collection:

- `chats/{sessionId}`

Recommended document shape:

```ts
{
  sessionId: string
  status: 'bot' | 'human'
  messages: {
    sender: 'user' | 'agent'
    text: string
    timestamp: number
  }[]
  unreadCount: number
  createdAt: number
  updatedAt: number
  agentJoinedAt?: number | null
  lastTelegramMessageId?: number | null
}
```

Basic Firestore rules for anonymous chat reads:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

Client writes are disabled because the website writes through Next.js API routes with Firebase Admin.

## 4. Telegram bot

Create a Telegram bot with BotFather, then add the bot to your support group.

Find your Telegram group chat id and set:

- `TELEGRAM_CHAT_ID`

## 5. Set the Telegram webhook

After deployment, point the bot webhook to:

```txt
https://your-domain.com/api/telegram-webhook
```

Set it with:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/telegram-webhook"
```

## 6. Local development

Run:

```bash
npm run dev
```

The chat widget is mounted globally in the root layout and appears on every page.

## 7. Human support flow

1. User asks a question.
2. FAQ keyword match returns an automatic answer.
3. If no FAQ match is found, the widget offers a `Contact Support` action.
4. When support is requested, the website forwards the message to Telegram.
5. Staff reply in Telegram by replying to the bot message that includes `sessionId`.
6. The Telegram webhook stores the reply in Firestore.
7. The website receives the new reply in real time via `onSnapshot`.
