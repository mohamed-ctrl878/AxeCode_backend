import React, { useEffect, useState, useCallback } from 'react';
import { getSocket, joinConversation, leaveConversation, onNewMessage, offNewMessage } from '../../utils/socket';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337/api';

export default function Chat({ conversationId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // load existing messages
  useEffect(() => {
    async function load() {
      const res = await axios.get(`${API_URL}/messages`, {
        params: {
          filters: { conversation: { id: conversationId } },
          populate: { users_permissions_user: { fields: ['id','username'] } },
          sort: ['createdAt:asc']
        }
      });
      setMessages(res.data.data.map((m) => ({
        id: m.id,
        ...m.attributes,
        sender: m.attributes.users_permissions_user?.data ? {
          id: m.attributes.users_permissions_user.data.id,
          ...m.attributes.users_permissions_user.data.attributes,
        } : null,
      })));
    }
    if (conversationId) load();
  }, [conversationId]);

  // connect socket and subscribe
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const socket = getSocket(token);

    joinConversation(conversationId);

    const handleNew = (msg) => {
      // msg comes from lifecycle emits
      setMessages((prev) => [...prev, msg]);
    };
    onNewMessage(handleNew);

    return () => {
      offNewMessage(handleNew);
      leaveConversation(conversationId);
    };
  }, [conversationId]);

  const send = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    await axios.post(`${API_URL}/messages`, {
      data: {
        message: [
          { type: 'paragraph', children: [{ type: 'text', text: input }]} 
        ],
        conversation: conversationId,
        users_permissions_user: currentUser.id,
        publishedAt: new Date().toISOString(),
      }
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('jwt') || ''}`
      }
    });

    setInput('');
    // UI will update when server emits 'new-message'
  }, [input, conversationId, currentUser?.id]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, height: 400, overflowY: 'auto' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, opacity: .7 }}>{m.sender?.username || 'Unknown'}</div>
            <div>
              {Array.isArray(m.message) ? m.message.map(b => b.children?.map(c => c.text).join('')).join('\n') : m.message}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: 8 }} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}