# WebSocket Implementation - Real-time Chat for Strapi v5

## Overview

This implementation adds real-time messaging capabilities to your Strapi backend using Socket.io, allowing instant message delivery to all participants in a conversation.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Frontend User  │◄───────►│  Strapi Server   │◄───────►│  Frontend User  │
│      (A)        │  HTTP   │   + Socket.io    │  WS     │      (B)        │
│                 │  & WS   │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                            │
        │ 1. POST /api/messages      │                            │
        │───────────────────────────>│                            │
        │                            │                            │
        │                    2. Save to DB                        │
        │                            │                            │
        │                    3. Lifecycle Hook                    │
        │                       (afterCreate)                     │
        │                            │                            │
        │                    4. Broadcast via WS                  │
        │                            │───────────────────────────>│
        │                            │    emit('new-message')     │
        │ 5. Receive via WS          │                            │
        │<───────────────────────────┤                            │
        │    emit('new-message')     │                            │
        │                            │                            │
```

## Backend Components

### 1. src/index.js (Bootstrap)

**Purpose**: Initialize Socket.io server and handle WebSocket connections.

**Key Features**:
- Attaches Socket.io to Strapi's HTTP server
- Configures CORS for frontend connection
- Makes `strapi.io` globally accessible
- Handles `join-conversation` and `leave-conversation` events
- Logs connections/disconnections

**Why it works**:
- Socket.io automatically handles WebSocket connections
- Rooms (`conversation-${id}`) isolate broadcasts to specific conversations
- Global `strapi.io` allows lifecycle hooks and services to emit events

### 2. src/api/message/content-types/message/lifecycles.js

**Purpose**: Automatically broadcast messages when they're created, updated, or deleted.

**Key Features**:
- `afterCreate`: Broadcasts new messages to conversation room
- `afterUpdate`: Broadcasts message edits (optional)
- `afterDelete`: Broadcasts message deletions (optional)
- Populates relationships (sender, conversation) before broadcasting

**Why it works**:
- Lifecycle hooks run automatically after database operations
- Uses `strapi.entityService.findOne()` to get full message with relations
- `strapi.io.to(room).emit()` sends only to users in that conversation

## Frontend Components

### 1. utils/socket.js (Socket Service)

**Purpose**: Singleton service to manage Socket.io client connection.

**Key Features**:
- Maintains single connection across app
- Provides methods to join/leave conversations
- Event listeners for new messages, updates, deletions
- Auto-reconnection on disconnect

### 2. utils/api.js (REST API Service)

**Purpose**: Handle HTTP requests to Strapi REST API.

**Key Features**:
- JWT authentication via interceptor
- Create/fetch messages
- Get conversation details
- Properly formats Strapi v5 request body

### 3. components/Chat.jsx (Main Chat Component)

**Purpose**: Display conversation and handle real-time updates.

**Key Features**:
- Loads existing messages on mount
- Connects to WebSocket and joins conversation room
- Listens for real-time events (`new-message`, etc.)
- Sends messages via REST API (which triggers WebSocket broadcast)
- Auto-scrolls to newest message

## How Real-time Updates Work

### Message Send Flow:

1. **User types and submits message** (Frontend)
   - Calls `messageAPI.create()` with conversation ID and message content

2. **REST API receives request** (Strapi)
   - Validates permissions, data structure
   - Saves message to database

3. **Lifecycle hook triggered** (Strapi)
   - `afterCreate` runs automatically
   - Fetches complete message with relationships
   - Determines conversation room

4. **WebSocket broadcast** (Socket.io)
   - `strapi.io.to('conversation-123').emit('new-message', data)`
   - Only sends to clients in that specific room

5. **Frontend receives update** (All connected clients)
   - Socket listener `onNewMessage()` fires
   - Updates state with new message
   - UI re-renders with new message

### Why This Design?

✅ **Security**: Messages still go through Strapi's REST API with full validation and permissions  
✅ **Reliability**: Database persists messages; WebSocket is just for notifications  
✅ **Scalability**: Rooms ensure broadcasts only go to relevant users  
✅ **Compatibility**: Works with existing Strapi authentication and content-types  
✅ **Separation of Concerns**: HTTP for mutations, WebSocket for notifications  

## Data Flow Example

### Creating a Message:

**Request** (Frontend → Strapi):
```javascript
POST /api/messages
{
  "data": {
    "message": [
      {
        "type": "paragraph",
        "children": [{ "type": "text", "text": "Hello!" }]
      }
    ],
    "conversation": 1,
    "users_permissions_user": 5,
    "publishedAt": "2025-01-17T00:00:00.000Z"
  }
}
```

**Broadcast** (Strapi → All Clients in Room):
```javascript
emit('new-message', {
  id: 42,
  message: [/* blocks format */],
  createdAt: "2025-01-17T00:00:00.000Z",
  updatedAt: "2025-01-17T00:00:00.000Z",
  sender: {
    id: 5,
    username: "john_doe",
    email: "john@example.com"
  },
  conversationId: 1
})
```

## Key Configuration Points

### Backend `.env`:
```env
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env`:
```env
REACT_APP_API_URL=http://localhost:1337/api
REACT_APP_SOCKET_URL=http://localhost:1337
```

## Testing the Implementation

### 1. Start Strapi Backend:
```bash
npm run dev
```

Look for log: `[Socket.io] WebSocket server initialized`

### 2. Test WebSocket Connection:
Open browser console and connect:
```javascript
const socket = io('http://localhost:1337');
socket.on('connect', () => console.log('Connected:', socket.id));
socket.emit('join-conversation', 1);
socket.on('new-message', (msg) => console.log('New message:', msg));
```

### 3. Create a Message via REST API:
```bash
curl -X POST http://localhost:1337/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "data": {
      "message": [{"type": "paragraph", "children": [{"type": "text", "text": "Test"}]}],
      "conversation": 1,
      "users_permissions_user": 1,
      "publishedAt": "2025-01-17T00:00:00.000Z"
    }
  }'
```

You should see the message appear in the browser console via WebSocket!

### 4. Test with Frontend:
- Open chat in two browser tabs
- Send message from Tab 1
- See it instantly appear in Tab 2

## Troubleshooting

### WebSocket not connecting:
- Check CORS configuration in `src/index.js`
- Verify `REACT_APP_SOCKET_URL` matches Strapi server URL
- Check browser console for connection errors

### Messages not broadcasting:
- Verify `strapi.io` is defined (check bootstrap logs)
- Ensure lifecycle file exists at correct path
- Check Strapi logs for lifecycle errors
- Confirm conversation ID is valid

### Messages appear twice:
- This is expected behavior: both sender and receiver get WebSocket event
- Add duplicate detection in frontend (check by message ID)
- Already handled in example `Chat.jsx` component

## Extending the Implementation

### Add Typing Indicators:
```javascript
// Backend (src/index.js)
socket.on('typing-start', ({ conversationId, username }) => {
  socket.to(`conversation-${conversationId}`).emit('user-typing', { username });
});

// Frontend
socketService.socket.emit('typing-start', { conversationId, username: currentUser.username });
socketService.socket.on('user-typing', ({ username }) => {
  console.log(`${username} is typing...`);
});
```

### Add Read Receipts:
Create a `ReadReceipt` content-type and emit events when messages are read.

### Add Authentication:
```javascript
// Backend (src/index.js)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT token
  if (isValid(token)) {
    next();
  } else {
    next(new Error('Authentication error'));
  }
});
```

## Production Considerations

### 1. Use Environment Variables:
Never hardcode URLs or ports.

### 2. Scale with Redis:
For multiple Strapi instances, use Redis adapter:
```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ host: 'localhost', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### 3. Add Rate Limiting:
Prevent spam by limiting emit frequency per user.

### 4. Monitor Connections:
Log active connections and disconnect idle clients.

### 5. Handle Reconnections:
Frontend should rejoin rooms after reconnecting.

## Summary

This implementation provides:
- ✅ Real-time message broadcasting
- ✅ Conversation-based room isolation
- ✅ Full integration with Strapi permissions and validation
- ✅ Automatic cleanup and error handling
- ✅ Scalable architecture
- ✅ Complete frontend example

All messages still go through Strapi's REST API for proper validation, while WebSocket provides instant notifications to connected clients.
