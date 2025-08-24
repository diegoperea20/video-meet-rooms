'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

interface Participant {
  id: string;
  name: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isOnline: boolean;
}

export function useSocket(roomId: string, userName: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId || !userName) return;

    console.log('Connecting to Socket.IO server...');
    
    // Connect to the Socket.IO server running on port 4001
    const serverUrl = 'http://localhost:4001';
    const socketConnection = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });
    
    setSocket(socketConnection);
    socketRef.current = socketConnection;

    socketConnection.on('connect', () => {
      console.log('Connected to socket server with ID:', socketConnection.id);
      setIsConnected(true);
      
      // Join the room
      socketConnection.emit('join-call', { 
        url: roomId, 
        name: userName 
      });
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setIsConnected(false);
    });

    socketConnection.on('user-joined', (id: string, clients: string[], userList: any[]) => {
      console.log('User joined:', id, 'Total clients:', clients.length);
      const participantsList = userList.map(user => ({
        id: user.id,
        name: user.name,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isOnline: true
      }));
      setParticipants(participantsList);
    });

    socketConnection.on('user-left', (id: string, userList: any[]) => {
      console.log('User left:', id);
      const participantsList = userList.map(user => ({
        id: user.id,
        name: user.name,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isOnline: true
      }));
      setParticipants(participantsList);
    });

    socketConnection.on('user-list', (userList: any[]) => {
      console.log('Received user list:', userList);
      const participantsList = userList.map(user => ({
        id: user.id,
        name: user.name,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isOnline: true
      }));
      setParticipants(participantsList);
    });

    socketConnection.on('chat-message', (data: string, sender: string, socketIdSender: string) => {
      console.log('Received chat message:', { data, sender, socketIdSender });
      const newMessage: Message = {
        id: uuidv4(),
        sender,
        message: data,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Increment unread count only if the message is not from current user
      if (sender !== userName) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socketConnection.on('track-change', (fromId: string, data: { kind: string; enabled: boolean }) => {
      console.log('Track change received:', { fromId, data });
      // Update participant's audio/video status based on track changes
      setParticipants(prev => prev.map(p => {
        if (p.id === fromId) {
          return {
            ...p,
            isAudioEnabled: data.kind === 'audio' ? data.enabled : p.isAudioEnabled,
            isVideoEnabled: data.kind === 'video' ? data.enabled : p.isVideoEnabled
          };
        }
        return p;
      }));
    });

    return () => {
      console.log('Cleaning up socket connection');
      if (socketConnection) {
        socketConnection.emit('leave-call');
        socketConnection.disconnect();
      }
    };
  }, [roomId, userName]);

  const sendMessage = (message: string) => {
    if (socket && isConnected) {
      console.log('Sending message:', message);
      socket.emit('chat-message', message, userName);
    } else {
      console.error('Cannot send message: socket not connected');
    }
  };

  const markMessagesAsRead = () => {
    setUnreadCount(0);
  };

  return {
    socket,
    participants,
    messages,
    unreadCount,
    sendMessage,
    markMessagesAsRead,
    isConnected
  };
}