# Frontend Integration Guide - Socket.io with React

This guide shows how to integrate the WebSocket functionality into your React frontend.

## Installation

```bash
npm install socket.io-client
```

## 1. Socket Service (utils/socket.js)

Create a reusable socket service:

```javascript
// src/utils/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:1337';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token, // Optional: for authentication
      },
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  joinConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('join-conversation', conversationId);
      console.log('[Socket] Joining conversation:', conversationId);
    }
  }

  leaveConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('leave-conversation', conversationId);
      console.log('[Socket] Leaving conversation:', conversationId);
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  onMessageUpdated(callback) {
    if (this.socket) {
      this.socket.on('message-updated', callback);
    }
  }

  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.on('message-deleted', callback);
    }
  }

  offNewMessage() {
    if (this.socket) {
      this.socket.off('new-message');
    }
  }

  offMessageUpdated() {
    if (this.socket) {
      this.socket.off('message-updated');
    }
  }

  offMessageDeleted() {
    if (this.socket) {
      this.socket.off('message-deleted');
    }
  }
}

export default new SocketService();
```

## 2. API Service (utils/api.js)

Create REST API calls for sending messages:

```javascript
// src/utils/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const messageAPI = {
  // Create a new message
  async create(conversationId, messageContent, userId) {
    const response = await api.post('/messages', {
      data: {
        message: messageContent,
        conversation: conversationId,
        users_permissions_user: userId,
        publishedAt: new Date().toISOString(), // Auto-publish
      },
    });
    return response.data;
  },

  // Get messages for a conversation
  async getByConversation(conversationId) {
    const response = await api.get('/messages', {
      params: {
        filters: {
          conversation: {
            id: conversationId,
          },
        },
        populate: {
          users_permissions_user: {
            fields: ['id', 'username', 'email'],
          },
        },
        sort: ['createdAt:asc'],
      },
    });
    return response.data;
  },
};

export const conversationAPI = {
  // Get conversation details
  async getById(conversationId) {
    const response = await api.get(`/conversations/${conversationId}`, {
      params: {
        populate: {
          users_permissions_users: {
            fields: ['id', 'username', 'email'],
          },
        },
      },
    });
    return response.data;
  },

  // Get all conversations for current user
  async getUserConversations(userId) {
    const response = await api.get('/conversations', {
      params: {
        filters: {
          users_permissions_users: {
            id: userId,
          },
        },
        populate: {
          users_permissions_users: {
            fields: ['id', 'username'],
          },
        },
      },
    });
    return response.data;
  },
};

export default api;
```

## 3. Chat Component (components/Chat.jsx)

Main chat component with real-time updates:

```javascript
// src/components/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import socketService from '../utils/socket';
import { messageAPI, conversationAPI } from '../utils/api';

const Chat = ({ conversationId, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize: Load conversation and messages
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setLoading(true);

        // Load conversation details
        const convData = await conversationAPI.getById(conversationId);
        setConversation(convData.data);

        // Load existing messages
        const messagesData = await messageAPI.getByConversation(conversationId);
        setMessages(messagesData.data || []);

        // Connect to Socket.io
        const token = localStorage.getItem('jwt');
        socketService.connect(token);

        // Join conversation room
        socketService.joinConversation(conversationId);

        // Listen for new messages
        socketService.onNewMessage((messageData) => {
          console.log('[Chat] New message received:', messageData);
          
          // Avoid duplicates (don't add if we just sent it)
          setMessages((prev) => {
            const exists = prev.find((msg) => msg.id === messageData.id);
            if (!exists) {
              return [...prev, messageData];
            }
            return prev;
          });
        });

        // Listen for message updates
        socketService.onMessageUpdated((messageData) => {
          console.log('[Chat] Message updated:', messageData);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageData.id ? messageData : msg))
          );
        });

        // Listen for message deletions
        socketService.onMessageDeleted((data) => {
          console.log('[Chat] Message deleted:', data.id);
          setMessages((prev) => prev.filter((msg) => msg.id !== data.id));
        });

        setLoading(false);
      } catch (error) {
        console.error('[Chat] Initialization error:', error);
        setLoading(false);
      }
    };

    if (conversationId && currentUser) {
      initializeChat();
    }

    // Cleanup on unmount
    return () => {
      socketService.leaveConversation(conversationId);
      socketService.offNewMessage();
      socketService.offMessageUpdated();
      socketService.offMessageDeleted();
    };
  }, [conversationId, currentUser]);

  // Send message via REST API (which triggers WebSocket broadcast)
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    try {
      // Send message via REST API
      await messageAPI.create(
        conversationId,
        [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: newMessage }],
          },
        ],
        currentUser.id
      );

      // Clear input
      setNewMessage('');

      // Note: The message will be added to UI via WebSocket event
      // No need to manually update state here
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
      alert('Failed to send message');
    }
  };

  if (loading) {
    return <div className="chat-loading">Loading chat...</div>;
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>{conversation?.attributes?.title || 'Conversation'}</h2>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => {
          const isOwnMessage =
            msg.sender?.id === currentUser.id ||
            msg.users_permissions_user?.id === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}
            >
              <div className="message-sender">
                {msg.sender?.username || msg.users_permissions_user?.username || 'Unknown'}
              </div>
              <div className="message-content">
                {/* Handle blocks format from Strapi */}
                {Array.isArray(msg.message) 
                  ? msg.message
                      .map((block) =>
                        block.children?.map((child) => child.text).join('')
                      )
                      .join('\n')
                  : msg.message}
              </div>
              <div className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button type="submit" className="chat-send-btn">
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
```

## 4. App Component (App.jsx)

Example of how to use the Chat component:

```javascript
// src/App.jsx
import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    // Get current user from localStorage or API
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);

    // Example: Set a conversation ID (from URL or props)
    const conversationId = '1'; // Replace with actual ID
    setSelectedConversation(conversationId);
  }, []);

  if (!currentUser) {
    return <div>Please log in</div>;
  }

  return (
    <div className="App">
      <h1>Real-time Chat</h1>
      {selectedConversation && (
        <Chat conversationId={selectedConversation} currentUser={currentUser} />
      )}
    </div>
  );
}

export default App;
```

## 5. Basic Styling (App.css)

```css
/* src/App.css */
.chat-container {
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 600px;
}

.chat-header {
  padding: 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.chat-header h2 {
  margin: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 70%;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.own-message {
  align-self: flex-end;
  background: #007bff;
  color: white;
}

.other-message {
  align-self: flex-start;
  background: #e9ecef;
  color: #333;
}

.message-sender {
  font-size: 12px;
  font-weight: bold;
  opacity: 0.8;
}

.message-content {
  font-size: 14px;
  white-space: pre-wrap;
}

.message-time {
  font-size: 11px;
  opacity: 0.6;
  text-align: right;
}

.chat-input-form {
  display: flex;
  padding: 16px;
  border-top: 1px solid #ddd;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.chat-send-btn {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.chat-send-btn:hover {
  background: #0056b3;
}

.chat-loading {
  padding: 20px;
  text-align: center;
}
```

## 6. Environment Variables

Create a `.env` file in your React app:

```env
REACT_APP_API_URL=http://localhost:1337/api
REACT_APP_SOCKET_URL=http://localhost:1337
```

## How It Works

### Real-time Flow:

1. **User connects**: Frontend calls `socketService.connect()` when chat loads
2. **Join room**: Frontend emits `join-conversation` event with conversation ID
3. **Send message**: User types and submits → REST API POST to `/api/messages`
4. **Strapi creates message**: Message is saved to database
5. **Lifecycle triggered**: `afterCreate` lifecycle hook runs
6. **WebSocket broadcast**: Strapi emits `new-message` to all clients in that conversation room
7. **Frontend receives**: All connected clients listening to `new-message` update their UI instantly

### Key Benefits:

- **Instant updates**: Messages appear immediately for all users
- **No polling**: More efficient than repeatedly checking for new messages
- **Scalable**: Socket.io rooms ensure messages only go to relevant users
- **Reliable**: Falls back to HTTP long-polling if WebSocket unavailable
- **RESTful**: Still uses Strapi's REST API for message creation (proper validation, permissions, etc.)

## Testing

1. Start Strapi: `npm run dev` (should see "WebSocket server initialized" log)
2. Start React app: `npm start`
3. Open multiple browser tabs with the same conversation
4. Send a message from one tab → see it appear instantly in all tabs!
