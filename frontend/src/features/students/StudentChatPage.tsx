import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage, AdminContact } from '../../types';
import {
  Send,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  Check,
  CheckCheck,
  Search,
  MessageSquare,
  User,
  ShieldCheck,
  X,
  AlertCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';

export const StudentChatPage: React.FC = () => {
  const { user } = useAuth();

  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminContact | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  const [inputText, setInputText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Image lightbox preview modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Mobile view toggle (contacts vs active chat)
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of message list
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Fetch available admins
  const fetchAdmins = async () => {
    try {
      const res = await api.get<AdminContact[]>('/chat/admins');
      setAdmins(res.data);
      if (res.data.length > 0 && !selectedAdmin) {
        handleSelectAdmin(res.data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load mentors/admins', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 2. Select admin and start/open conversation
  const handleSelectAdmin = async (contact: AdminContact) => {
    setSelectedAdmin(contact);
    setMobileShowChat(true);
    setErrorMessage(null);

    let convId = contact.conversation_id;
    if (!convId) {
      try {
        setLoadingMessages(true);
        const res = await api.post('/chat/conversations/start', {
          admin_id: contact.admin.id,
        });
        convId = res.data.conversation_id;
        setActiveConversationId(convId);
        contact.conversation_id = convId;
      } catch (err: any) {
        setErrorMessage(err.response?.data?.detail || 'Failed to start conversation.');
        setLoadingMessages(false);
        return;
      }
    } else {
      setActiveConversationId(convId);
    }

    if (convId) {
      fetchMessages(convId, true);
    }
  };

  // 3. Fetch conversation messages
  const fetchMessages = async (convId: string, isInitial = false) => {
    try {
      if (isInitial) setLoadingMessages(true);
      const res = await api.get<ChatMessage[]>(`/chat/conversations/${convId}/messages`);
      setMessages(res.data);
      if (isInitial) {
        setTimeout(() => scrollToBottom('auto'), 100);
      }
    } catch (err: any) {
      console.error('Failed to load messages', err);
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  };

  // 4. Smart Polling: Fetch latest messages every 3.5 seconds
  useEffect(() => {
    if (!activeConversationId) return;

    const interval = setInterval(() => {
      fetchMessages(activeConversationId, false);
    }, 3500);

    return () => clearInterval(interval);
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // 5. Handle File Selection with STRICT VIDEO REJECTION
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check video extensions and MIME types
    const blockedVideoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp', '.wmv', '.flv', '.m4v'];
    const lowerName = file.name.toLowerCase();
    const isVideoExt = blockedVideoExts.some((ext) => lowerName.endsWith(ext));
    const isVideoMime = file.type.startsWith('video/');

    if (isVideoExt || isVideoMime) {
      setErrorMessage('Video uploads are strictly not allowed. You can only share images, PDFs, and documents.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Size limit 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage(`File exceeds 15MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  };

  // 6. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId) return;
    if (!inputText.trim() && !selectedFile) return;

    try {
      setSending(true);
      setErrorMessage(null);

      const formData = new FormData();
      if (inputText.trim()) {
        formData.append('message_text', inputText.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await api.post<ChatMessage>(
        `/chat/conversations/${activeConversationId}/messages`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Append locally for immediate snappy feedback
      setMessages((prev) => [...prev, res.data]);
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      scrollToBottom();
      fetchAdmins(); // refresh last message snippet
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredAdmins = admins.filter((a) =>
    a.admin.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.admin.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-5rem)] max-w-7xl mx-auto flex bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* LEFT COLUMN: Admin / Mentor Contacts List */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/60 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 font-bold">
                <MessageSquare className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900">Faculty Mentors</h1>
                <p className="text-[11px] text-slate-500 font-medium">Direct Admin &amp; Mentor Support</p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mentor or admin..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingAdmins ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold">
              Loading faculty mentors...
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold">
              No faculty mentors found.
            </div>
          ) : (
            filteredAdmins.map((item) => {
              const isSelected = selectedAdmin?.admin.id === item.admin.id;
              return (
                <div
                  key={item.admin.id}
                  onClick={() => handleSelectAdmin(item)}
                  className={`p-3.5 flex items-start space-x-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-100/60 border-l-4 border-amber-600' : 'hover:bg-slate-100/80'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-amber-300 font-bold flex items-center justify-center text-xs shadow-xs">
                      {item.admin.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {item.admin.full_name}
                      </span>
                      {item.last_message_at && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(item.last_message_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-[11px] text-amber-700 font-semibold">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>Faculty Mentor / Admin</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.last_message_text || 'Tap to start conversation'}
                    </p>
                  </div>

                  {item.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white font-extrabold text-[10px]">
                      {item.unread_count}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: WhatsApp-Style Active Conversation Pane */}
      <div
        className={`flex-1 flex flex-col bg-[#f8f9fa] ${
          !mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedAdmin ? (
          <>
            {/* Chat Pane Header */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-full bg-slate-900 text-amber-300 font-bold flex items-center justify-center text-xs">
                  {selectedAdmin.admin.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>

                <div>
                  <h2 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                    <span>{selectedAdmin.admin.full_name}</span>
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded-full border border-amber-300">
                      Official Mentor
                    </span>
                  </h2>
                  <div className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Available for Mentorship &amp; Session Inquiries</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                No deletion • Permanent audit log
              </div>
            </div>

            {/* Error Notification Bar */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]/30">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Start Conversation with {selectedAdmin.admin.full_name}</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Ask questions regarding your upcoming sessions, reschedule queries, share research drafts, or request study materials.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  const timeFormatted = new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md sm:max-w-lg p-3 rounded-2xl shadow-xs text-xs space-y-1.5 ${
                          isMe
                            ? 'bg-amber-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {/* Sender Name in Admin Messages */}
                        {!isMe && (
                          <div className="font-extrabold text-[10px] text-amber-800 uppercase tracking-wider">
                            {msg.sender_name}
                          </div>
                        )}

                        {/* Text Message */}
                        {msg.message_text && (
                          <p className="whitespace-pre-line leading-relaxed text-xs">
                            {msg.message_text}
                          </p>
                        )}

                        {/* Attachment Preview */}
                        {msg.attachment_url && (
                          <div className="pt-1">
                            {msg.attachment_type === 'IMAGE' ? (
                              <div className="rounded-xl overflow-hidden border border-black/10 cursor-pointer">
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || 'Attachment'}
                                  onClick={() => setPreviewImageUrl(msg.attachment_url!)}
                                  className="max-h-60 w-auto rounded-lg object-cover hover:opacity-95 transition-opacity"
                                />
                              </div>
                            ) : (
                              <div
                                className={`p-2.5 rounded-xl border flex items-center justify-between space-x-3 ${
                                  isMe
                                    ? 'bg-amber-700/80 border-amber-500/60 text-white'
                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <FileText className={`w-5 h-5 flex-shrink-0 ${isMe ? 'text-amber-200' : 'text-blue-600'}`} />
                                  <div className="truncate">
                                    <div className="font-bold truncate text-[11px]">
                                      {msg.attachment_name || 'Document'}
                                    </div>
                                    {msg.file_size_bytes && (
                                      <div className={`text-[10px] ${isMe ? 'text-amber-200' : 'text-slate-400'}`}>
                                        {(msg.file_size_bytes / 1024).toFixed(0)} KB • {msg.attachment_type}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={msg.attachment_name || 'file'}
                                  className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                                    isMe
                                      ? 'bg-white/20 hover:bg-white/30 text-white'
                                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                                  }`}
                                  title="Download / View"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Timestamp & Read Indicator */}
                        <div
                          className={`flex items-center justify-end space-x-1 text-[10px] pt-0.5 ${
                            isMe ? 'text-amber-100' : 'text-slate-400'
                          }`}
                        >
                          <span>{timeFormatted}</span>
                          {isMe && (
                            msg.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-amber-200" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected File Preview Pill (above input) */}
            {selectedFile && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-950 font-semibold">
                <div className="flex items-center space-x-2 truncate">
                  <Paperclip className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="text-[10px] text-amber-700">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1 rounded text-amber-700 hover:text-amber-950"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-slate-50 transition-colors"
                title="Attach Image, PDF, or Document (Videos not permitted)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message to faculty mentor..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <button
                type="submit"
                disabled={sending || (!inputText.trim() && !selectedFile)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  sending || (!inputText.trim() && !selectedFile)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                }`}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">Select a Faculty Mentor</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Choose an admin or mentor from the left roster to view messages and communicate.
            </p>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-amber-300 font-bold"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentChatPage;
