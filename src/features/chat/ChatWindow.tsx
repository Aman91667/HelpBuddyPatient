import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Paperclip, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/client';
import { chatSocket } from '@/core/socket/chatSocket';
import { toast } from 'sonner';

interface Message {
  id: string;
  serviceId: string;
  senderId: string;
  senderType: 'PATIENT' | 'HELPER';
  message?: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
  fileUrl?: string;
  fileName?: string;
  isRead: boolean;
  createdAt: string;
}

interface ChatWindowProps {
  serviceId: string;
  helperName: string;
  onClose: () => void;
}

export function ChatWindow({ serviceId, helperName, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadMessages();
    
    // Connect socket and join service room
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId') || '';
    if (token) {
      chatSocket.connect(token);
      chatSocket.joinService(serviceId);
    }

    // Listen for new messages
    chatSocket.onNewMessage((message) => {
      if (message.serviceId === serviceId) {
        setMessages(prev => {
          // If we already have this id, replace
          const exists = prev.find(m => m.id === message.id);
          if (exists) return prev.map(m => (m.id === message.id ? message : m));

          // Try to match and replace optimistic temp messages (by sender, text and time proximity)
          const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.senderId === message.senderId && m.message === message.message && Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000);
          if (tempIndex !== -1) {
            const copy = [...prev];
            copy[tempIndex] = message;
            return copy;
          }

          return [...prev, message];
        });

        scrollToBottom();
        
        // Mark as read if not sent by us
        if (message.senderType !== 'PATIENT') {
          chatSocket.emitMarkAsRead(serviceId, userId);
        }
      }
    });

    // Listen for messages read updates
    chatSocket.onMessagesRead(() => {
      // Update all our sent messages to read status
      setMessages(prev => prev.map(msg => 
        msg.senderType === 'PATIENT' ? { ...msg, isRead: true } : msg
      ));
    });

    // Listen for typing indicator
    chatSocket.onTypingStart((_data: { senderId: string }) => {
      setIsTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to hide typing indicator
      typingTimeoutRef.current = window.setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    });

    chatSocket.onTypingStop(() => {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    });

    return () => {
      chatSocket.leaveService();
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [serviceId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Message[]>(`/chat/service/${serviceId}/messages`);
      if (response.success && response.data) {
        setMessages(response.data);
        scrollToBottom();
      }
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Send via socket only (server will persist and emit to the room)
      chatSocket.sendMessage({
        serviceId,
        messageType: 'TEXT',
        messageText: messageContent,
      });

      // Optimistic UI: add a temporary message until server echoes back
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const tempMsg: Message = {
        id: tempId,
        serviceId,
        senderId: localStorage.getItem('userId') || 'me',
        senderType: 'PATIENT',
        message: messageContent,
        messageType: 'TEXT',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom();
    } catch (error) {
      toast.error('Failed to send message');
      setNewMessage(messageContent); // Restore message
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    chatSocket.emitTypingStart(serviceId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    msgs.forEach(msg => {
      const date = new Date(msg.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] sm:h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-t-2xl">
          <div>
            <h3 className="font-semibold text-lg">{helperName}</h3>
            <p className="text-xs text-white/80">Helper</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Start a conversation with your helper</p>
            </div>
          ) : (
            <>
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full">
                      {date}
                    </div>
                  </div>

                  {/* Messages for this date */}
                  {Array.isArray(msgs) && msgs.map((message) => {
                    const isOwn = message.senderType === 'PATIENT';
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isOwn ? 'justify-start' : 'justify-end'} mb-3`}
                      >
                        <div className={`max-w-[70%] ${isOwn ? 'order-1' : 'order-2'}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isOwn
                                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                                : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {message.messageType === 'TEXT' ? (
                              message.message ? (
                                <p className={`text-sm break-words ${isOwn ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{message.message}</p>
                              ) : (
                                <p className={`text-xs italic ${isOwn ? 'text-white/70' : 'text-slate-700/50 dark:text-slate-300/50'}`}>
                                  [Message data: {JSON.stringify({ type: message.messageType, hasMsg: !!message.message })}]
                                </p>
                              )
                            ) : null}
                            {message.messageType === 'IMAGE' && message.fileUrl && (
                              <div className="space-y-2">
                                <img
                                  src={message.fileUrl}
                                  alt="Sent image"
                                  className="rounded-lg max-w-full"
                                />
                                {message.message && (
                                  <p className={`text-sm ${isOwn ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{message.message}</p>
                                )}
                              </div>
                            )}
                            {message.messageType === 'FILE' && message.fileUrl && (
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4" />
                                <a
                                  href={message.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm underline"
                                >
                                  {message.fileName || 'Download file'}
                                </a>
                              </div>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 px-2`}>
                            {isOwn ? (
                              <>
                                <span className="text-slate-400">
                                  {message.isRead ? (
                                    <CheckCheck className="h-3 w-3 text-blue-400" />
                                  ) : (
                                    <Check className="h-3 w-3 text-white/70" />
                                  )}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {formatTime(message.createdAt)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="w-3 h-3"></span>
                                <span className="text-xs text-slate-400">
                                  {formatTime(message.createdAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2 text-slate-400"
                  >
                    <div className="flex gap-1 bg-slate-100 rounded-full px-4 py-2">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-slate-50 pb-safe">
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-slate-600"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 bg-white border rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-emerald-500">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full resize-none outline-none text-sm max-h-24"
                rows={1}
              />
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-full h-10 w-10 p-0"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
