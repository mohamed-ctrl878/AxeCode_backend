# Quick Start Guide - WebSocket Chat Integration

## ✅ What's Been Set Up

### Backend (Strapi):
1. ✅ Socket.io installed (`npm install socket.io`)
2. ✅ `src/index.js` - WebSocket server initialized in bootstrap
3. ✅ `src/api/message/content-types/message/lifecycles.js` - Broadcasts new messages

### Frontend (React):
1. ✅ `socket.io-client` installed
2. ✅ `src/utils/socket.js` - WebSocket client utility
3. ✅ `src/components/Chat/Chat.jsx` - Real-time chat component
4. ✅ `.env` - Updated with Socket URL
5. ✅ Chat added to navigation in App.js

## 🚀 How to Test

### Step 1: Start Backend (Strapi)
```bash
npm run dev
```

You should see in console:
```
[Socket.io] WebSocket server initialized
```

### Step 2: Create Test Data in Strapi Admin

1. Go to http://localhost:1337/admin
2. Create a **Conversation** (Content Manager → Conversation):
   - Title: "Test Chat"
   - Add some users to participants
   - Save & Publish

3. Note the conversation ID (e.g., `1`)

### Step 3: Start Frontend
```bash
cd frontend
npm start
```

### Step 4: Test Real-time Chat

1. **Login** to your app
2. Click **💬 Chat** button in navigation
3. You should see the Chat component
4. Type a message and click "Send"

### Step 5: Test Real-time (Multiple Tabs)

1. Open the app in **two browser tabs** (or different browsers)
2. Login in both tabs
3. Navigate to **💬 Chat** in both
4. Send a message from Tab 1
5. **Watch it instantly appear in Tab 2!** 🎉

## 🔧 How It Works

```
User types message → REST API POST /api/messages
                      ↓
              Strapi saves to DB
                      ↓
         Lifecycle hook triggers (afterCreate)
                      ↓
      WebSocket broadcasts to conversation room
                      ↓
    All connected clients receive "new-message" event
                      ↓
           Frontend updates UI instantly
```

## 📝 Console Logs to Watch For

### Backend (Strapi):
```
[Socket.io] WebSocket server initialized
[Socket.io] New connection: abc123
[Socket.io] Socket abc123 joined room: conversation-1
[Lifecycle] Broadcasted message 5 to room: conversation-1
```

### Frontend (Browser Console):
```
[Socket] Connected abc123
[Chat] New message received: {id: 5, message: [...], ...}
```

## 🎯 Integration Points

### 1. Socket Connection (`src/utils/socket.js`)
```javascript
import { getSocket, joinConversation, onNewMessage } from './utils/socket';

// Connect
const socket = getSocket(jwt_token);

// Join a conversation room
joinConversation(conversationId);

// Listen for new messages
onNewMessage((message) => {
  console.log('New message!', message);
});
```

### 2. Send Message (via REST API)
```javascript
await axios.post('http://localhost:1337/api/messages', {
  data: {
    message: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello!' }] }],
    conversation: conversationId,
    users_permissions_user: userId,
    publishedAt: new Date().toISOString(),
  }
}, {
  headers: { Authorization: `Bearer ${jwt}` }
});
// Message will be broadcast via WebSocket automatically!
```

### 3. In Your Own Component
```javascript
import Chat from './components/Chat/Chat';

function MyComponent() {
  const user = { id: 1, username: 'john' }; // from your auth
  const conversationId = 1; // from props or state

  return <Chat conversationId={conversationId} currentUser={user} />;
}
```

## 🛠️ Customization

### Change Conversation ID
In `src/App.js`, line 407:
```javascript
<Chat conversationId={1} currentUser={user} />
//                    ↑ Change this
```

### Add More Events
In backend `src/index.js`, add more event listeners:
```javascript
socket.on('typing-start', (data) => {
  socket.to(`conversation-${data.conversationId}`).emit('user-typing', data);
});
```

In frontend `src/utils/socket.js`:
```javascript
export function onTyping(cb) {
  socketInstance?.on('user-typing', cb);
}
```

### Style the Chat Component
The Chat component in `src/components/Chat/Chat.jsx` uses inline styles for simplicity.
You can replace them with styled-components or CSS modules to match your app design.

## 🐛 Troubleshooting

### WebSocket not connecting?
- Check backend console for `[Socket.io] WebSocket server initialized`
- Check frontend console for `[Socket] Connected`
- Verify `.env` has correct URLs (http://localhost:1337)

### Messages not appearing?
- Check you're using conversation ID `1` (or one that exists in DB)
- Verify message was saved in Strapi admin (Content Manager → Messages)
- Check backend logs for `[Lifecycle] Broadcasted message...`

### CORS errors?
- Check `src/index.js` CORS config:
```javascript
cors: {
  origin: 'http://localhost:3000', // Your frontend URL
  methods: ['GET', 'POST'],
  credentials: true,
}
```

## 📚 Next Steps

1. **Create Conversation List**: Show all user's conversations
2. **Add Typing Indicators**: Show when someone is typing
3. **Add Read Receipts**: Track when messages are read
4. **Add File Uploads**: Send images/files in chat
5. **Add User Presence**: Show who's online
6. **Style Chat UI**: Make it look beautiful!

## 🎉 You're All Set!

Your Strapi backend now broadcasts real-time messages via WebSocket, and your React frontend receives them instantly. Test it with multiple tabs to see the magic! ✨
