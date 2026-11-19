import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage, StudentContact } from '../../types';
import {
  Send,
  Paperclip,
  FileText,
  Download,
  Check,
  CheckCheck,
  Search,
  MessageSquare,
  GraduationCap,
  X,
  AlertCircle,
  ArrowLeft,
  Filter
} from 'lucide-react';

export const AdminChatPage: React.FC = () => {
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentContact[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentContact | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  const [inputText, setInputText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState<boolean>(false);

  // Image lightbox preview
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Mobile toggle
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Fetch Students
  const fetchStudents = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      const res = await api.get<StudentContact[]>(`/chat/students?${params.toString()}`);
      setStudents(res.data);
      if (res.data.length > 0 && !selectedStudent) {
        handleSelectStudent(res.data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load students for chat', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchQuery]);

  // 2. Select student and start/load conversation
  const handleSelectStudent = async (contact: StudentContact) => {
    setSelectedStudent(contact);
    setMobileShowChat(true);
    setErrorMessage(null);

    let convId = contact.conversation_id;
    if (!convId) {
      try {
        setLoadingMessages(true);
        const res = await api.post('/chat/conversations/start', {
          student_id: contact.student.id,
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

  // 4. Smart Polling: Fetch every 3.5 seconds
  useEffect(() => {
    if (!activeConversationId) return;

    const interval = setInterval(() => {
      fetchMessages(activeConversationId, false);
    }, 3500);

    return () => clearInterval(interval);
  }, [activeConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // 5. File selection with strict video blocking
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const blockedVideoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp', '.wmv', '.flv', '.m4v'];
    const lowerName = file.name.toLowerCase();
    const isVideoExt = blockedVideoExts.some((ext) => lowerName.endsWith(ext));
    const isVideoMime = file.type.startsWith('video/');

    if (isVideoExt || isVideoMime) {
      setErrorMessage('Video uploads are strictly not allowed. You can only share images, PDFs, and documents.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage(`File exceeds 15MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  };

  // 6. Send message
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

      setMessages((prev) => [...prev, res.data]);
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      scrollToBottom();
      fetchStudents();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (unreadOnlyFilter && s.unread_count === 0) return false;
    return true;
  });

  return (
    <div className="h-[calc(100vh-5rem)] max-w-7xl mx-auto flex bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* LEFT COLUMN: Students Roster List */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/60 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-amber-300 font-bold">
                <MessageSquare className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900">Student Messages</h1>
                <p className="text-[11px] text-slate-500 font-medium">1-on-1 Mentorship Inbox</p>
              </div>
            </div>

            {/* Unread Filter Toggle */}
            <button
              type="button"
              onClick={() => setUnreadOnlyFilter(!unreadOnlyFilter)}
              className={`p-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                unreadOnlyFilter
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Filter by unread messages"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="text-[10px]">Unread</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name, ID or email..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingStudents ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold">
              Loading student conversations...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold">
              No students found.
            </div>
          ) : (
            filteredStudents.map((item) => {
              const isSelected = selectedStudent?.student.id === item.student.id;
              return (
                <div
                  key={item.student.id}
                  onClick={() => handleSelectStudent(item)}
                  className={`p-3.5 flex items-start space-x-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-50 border-l-4 border-amber-600' : 'hover:bg-slate-100/80'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs shadow-2xs">
                      {item.student.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    {item.unread_count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {item.student.full_name}
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
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{item.student.aptech_student_id || 'Student'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      {item.last_message_text || 'No messages yet'}
                    </p>
                  </div>

                  {item.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-600 text-white font-extrabold text-[10px]">
                      {item.unread_count}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Conversation Pane */}
      <div
        className={`flex-1 flex flex-col bg-[#f8f9fa] ${
          !mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedStudent ? (
          <>
            {/* Header */}
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
                  {selectedStudent.student.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>

                <div>
                  <h2 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                    <span>{selectedStudent.student.full_name}</span>
                    {selectedStudent.student.aptech_student_id && (
                      <span className="font-mono text-[10px] text-slate-500 font-normal">
                        ({selectedStudent.student.aptech_student_id})
                      </span>
                    )}
                  </h2>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {selectedStudent.student.email}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                Permanent log • No deletion
              </div>
            </div>

            {/* Error Notification */}
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
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No Messages Yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Start a conversation with {selectedStudent.student.full_name}. Share session schedules, feedback, or review documents.
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
                            ? 'bg-slate-900 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {/* Sender Label */}
                        {!isMe && (
                          <div className="font-extrabold text-[10px] text-amber-700 uppercase tracking-wider">
                            {msg.sender_name} (Student)
                          </div>
                        )}

                        {/* Text */}
                        {msg.message_text && (
                          <p className="whitespace-pre-line leading-relaxed text-xs">
                            {msg.message_text}
                          </p>
                        )}

                        {/* Attachment */}
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
                                    ? 'bg-slate-800 border-slate-700 text-white'
                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <FileText className={`w-5 h-5 flex-shrink-0 ${isMe ? 'text-amber-300' : 'text-blue-600'}`} />
                                  <div className="truncate">
                                    <div className="font-bold truncate text-[11px]">
                                      {msg.attachment_name || 'Document'}
                                    </div>
                                    {msg.file_size_bytes && (
                                      <div className={`text-[10px] ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
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
                            isMe ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <span>{timeFormatted}</span>
                          {isMe && (
                            msg.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-amber-300" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
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

            {/* Selected File Preview Pill */}
            {selectedFile && (
              <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-800 font-semibold">
                <div className="flex items-center space-x-2 truncate">
                  <Paperclip className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-500">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1 rounded text-slate-500 hover:text-slate-800"
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
                className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                title="Attach Image, PDF, or Document (Videos not permitted)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Reply to ${selectedStudent.student.full_name}...`}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />

              <button
                type="submit"
                disabled={sending || (!inputText.trim() && !selectedFile)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  sending || (!inputText.trim() && !selectedFile)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-sm'
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
            <h3 className="text-sm font-bold text-slate-700">Select a Student Conversation</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Click a student from the left roster to view their message history and reply.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
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

export default AdminChatPage;
