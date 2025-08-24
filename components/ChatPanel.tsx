'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  currentUser: string;
  onMarkAsRead?: () => void;
}

export default function ChatPanel({ messages, onSendMessage, currentUser, onMarkAsRead }: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
    // Mark messages as read when component is visible and messages change
    if (onMarkAsRead) {
      onMarkAsRead();
    }
  }, [messages, onMarkAsRead]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">Chat</h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 max-h-96 overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-4 pr-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === currentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[280px] px-3 py-2 rounded-lg break-words ${
                  message.sender === currentUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                <div className="text-sm font-medium mb-1">
                  {message.sender === currentUser ? 'You' : message.sender}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.message}</div>
                <div className="text-xs mt-1 opacity-70">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Button onClick={handleSendMessage} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}