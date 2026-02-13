'use strict';

/**
 * Messenger service coordinator (DIP & SRP Compliance)
 * Orchestrates specialized sub-services for a cleaner, maintainable WebSocket layer.
 */

module.exports = ({ strapi }) => {
  let ioInstance = null;

  // Dependency injection via Strapi service registry
  const getAuth = () => strapi.service('api::conversation.messenger-auth');
  const getRooms = () => strapi.service('api::conversation.room-manager');
  const getMessaging = () => strapi.service('api::conversation.messaging-logic');
  const getModeration = () => strapi.service('api::conversation.messenger-moderation');

  return {
    /**
     * Entry point to initialize Socket.IO logic
     */
    initialize(io) {
      ioInstance = io;

      // 1. Setup Authentication Middleware (SRP)
      io.use((socket, next) => getAuth().authenticate(socket, next));

      // 2. Event Routing
      io.on('connection', (socket) => {
        strapi.log.info(`[Messenger] Connected: ${socket.user.username} (${socket.id})`);

        socket.on('join-conversation', (id) => this.handleJoin(socket, id));
        socket.on('leave-conversation', (id) => this.handleLeave(socket, id));
        socket.on('send-message', (data) => this.handleSend(socket, data));
        socket.on('load-more-messages', (data) => this.handleLoadMore(socket, data));
        socket.on('toggle-mute-user', (data) => this.handleMute(socket, data));
        socket.on('manage-member', (data) => this.handleMemberMgmt(socket, data));

        socket.on('disconnecting', () => this.handleDisconnect(socket));
      });

      strapi.log.info('[Messenger] Coordinator initialized successfully');
    },

    /**
     * Handle user joining a room
     */
    async handleJoin(socket, conversationId) {
      try {
        const { exists, isAdmin, conversation } = await getModeration().getPermissions(conversationId, socket.user.documentId);
        
        if (!exists) return socket.emit('error', { message: 'Conversation not found' });

        const docId = conversation.documentId;

        // Security Policy: Check membership/admin/creator status
        const isMember = conversation.members?.some(m => m.documentId === socket.user.documentId) || isAdmin;
        if (!isMember) return socket.emit('error', { message: 'Access denied: Not a member' });

        getRooms().join(socket, docId);

        // Fetch History (SRP)
        const history = await getMessaging().getHistory(docId);
        const onlineCount = getRooms().getOnlineCount(ioInstance, docId);

        socket.emit('joined-conversation', { conversationId: docId, user: socket.user, onlineCount });
        socket.emit('conversation-history', { conversationId: docId, messages: history });

        getRooms().broadcastStatusUpdate(ioInstance, docId);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    },

    /**
     * Handle user leaving a room
     */
    handleLeave(socket, conversationId) {
      // Note: If conversationId is numeric, we might need to resolve it here too,
      // but usually the client joins with docId after joined-conversation event.
      getRooms().leave(socket, conversationId);
      getRooms().broadcastStatusUpdate(ioInstance, conversationId);
    },

    /**
     * Handle real-time messaging
     */
    async handleSend(socket, { conversationId, blocks }) {
      try {
        // Rate limiting (Basic)
        const now = Date.now();
        if (socket.lastTime && (now - socket.lastTime < 500)) return socket.emit('error', { message: 'Too fast' });
        socket.lastTime = now;

        // Resolution and Validation
        const { exists, conversation } = await getModeration().getPermissions(conversationId, socket.user.documentId);
        if (!exists) return socket.emit('error', { message: 'Conversation not found' });
        
        const docId = conversation.documentId;

        const validation = getMessaging().validateBlocks(blocks);
        if (!validation.valid) return socket.emit('error', { message: validation.reason });

        // Check Mute status
        const isMuted = conversation?.muted_users?.some(m => m.documentId === socket.user.documentId);
        if (isMuted) return socket.emit('error', { message: 'You are muted' });

        // Persist & Broadcast
        const message = await getMessaging().saveMessage(docId, socket.user.documentId, blocks);
        const payload = getMessaging().formatMessage(message, docId);
        
        ioInstance.to(`room-${docId}`).emit('new-message', payload);
      } catch (err) {
        socket.emit('error', { message: 'Message delivery failed' });
      }
    },

    /**
     * Handle history pagination
     */
    async handleLoadMore(socket, { conversationId, beforeTimestamp }) {
      try {
        const { exists, conversation } = await getModeration().getPermissions(conversationId, socket.user.documentId);
        if (!exists) return socket.emit('error', { message: 'Conversation not found' });
        
        const docId = conversation.documentId;
        const history = await getMessaging().getHistory(docId, 50, beforeTimestamp);
        socket.emit('more-messages', { conversationId: docId, messages: history });
      } catch (err) {
        socket.emit('error', { message: 'Failed to load more' });
      }
    },

    /**
     * Handle muting/unmuting (Admins only)
     */
    async handleMute(socket, { conversationId, targetUserDocumentId }) {
      try {
        const { isAdmin, conversation } = await getModeration().getPermissions(conversationId, socket.user.documentId);
        if (!isAdmin) return socket.emit('error', { message: 'Unauthorized' });

        const docId = conversation.documentId;
        const isNowMuted = await getModeration().toggleMute(docId, targetUserDocumentId);
        
        ioInstance.to(`room-${docId}`).emit('user-muted-status-changed', {
          conversationId: docId,
          userDocumentId: targetUserDocumentId,
          isMuted: isNowMuted
        });
      } catch (err) {
        socket.emit('error', { message: 'Mute action failed' });
      }
    },

    /**
     * Handle member roles (Creator only for admins)
     */
    async handleMemberMgmt(socket, { conversationId, targetUserDocumentId, action }) {
      try {
        const { isAdmin, isCreator, conversation } = await getModeration().getPermissions(conversationId, socket.user.documentId);
        
        if (!isAdmin) return socket.emit('error', { message: 'Unauthorized' });
        
        const docId = conversation.documentId;
        if ((action.includes('admin')) && !isCreator) return socket.emit('error', { message: 'Only creator can manage admins' });

        await getModeration().manageRoles(docId, targetUserDocumentId, action);
        
        ioInstance.to(`room-${docId}`).emit('conversation-updated', {
          conversationId: docId, action, userDocumentId: targetUserDocumentId
        });
      } catch (err) {
        socket.emit('error', { message: 'Management action failed' });
      }
    },

    /**
     * Handle cleanup and status update on disconnect
     */
    handleDisconnect(socket) {
      socket.rooms.forEach(room => {
        if (room.startsWith('room-')) {
          const docId = room.replace('room-', '');
          getRooms().broadcastStatusUpdate(ioInstance, docId, socket.id);
        }
      });
    }
  };
};
