import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Trash2, Calendar, Book, ChevronRight, Search, Menu, X, Cloud, Sun, CloudRain, Wind, Sparkles, Image as ImageIcon, MessageSquare, Send, Zap } from 'lucide-react';
import { DiaryEntry } from './types';
import { GoogleGenAI } from "@google/genai";
import { Solar, Lunar } from 'lunar-javascript';
import { diaryApi } from './lib/supabase';

// 延迟初始化AI实例，只在需要时才创建
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
};

export default function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodEmoji, setMoodEmoji] = useState('');
  const [weather, setWeather] = useState('');
  const [imageData, setImageData] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // AI Memory & Digital Twin states
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [warmTip, setWarmTip] = useState('');

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchEntries();
    fetchWeather();
    generateWarmTip();
  }, []);

  const fetchEntries = async () => {
    try {
      const data = await diaryApi.getEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    }
  };

  const fetchWeather = async () => {
    try {
      const res = await fetch('/api/weather');
      const text = await res.text();
      if (res.ok && text && !text.includes('Unknown') && !text.includes('Error')) {
        setWeather(text.trim());
      } else {
        setWeather('☀️ 22°C');
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err);
      setWeather('☀️ 22°C');
    }
  };

  const generateWarmTip = async () => {
    const ai = getAI();
    if (!ai) {
      setWarmTip('愿你今天拥有明媚的心情。');
      return;
    }
    try {
      const solar = Solar.fromDate(new Date());
      const lunar = Lunar.fromSolar(solar);
      const dateStr = `${solar.toFullString()} 农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `今天是 ${dateStr}，天气是 ${weather || '未知'}。请根据日期和天气，生成一句极简、温馨、正能量的提示语（20字以内）。例如：今天可能有雨，记得带伞哦。`,
      });
      setWarmTip(response.text?.trim() || '愿你今天拥有明媚的心情。');
    } catch (err) {
      setWarmTip('愿你今天拥有明媚的心情。');
    }
  };

  const handleAiQuery = async (query: string, isChat: boolean = false) => {
    if (!query.trim()) return;
    
    const ai = getAI();
    if (!ai) {
      const errorMsg = '请先配置 GEMINI_API_KEY 以使用AI功能。';
      if (isChat) setChatHistory(prev => [...prev, { role: 'ai', text: errorMsg }]);
      else setAiAnswer(errorMsg);
      return;
    }
    
    if (isChat) setIsAiLoading(true);
    else setAiAnswer(null);

    try {
      // Context: recent entries
      const context = entries.slice(0, 50).map(e => `日期: ${e.date}, 标题: ${e.title}, 内容: ${e.content}`).join('\n---\n');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你是一个私人情绪树洞的数字孪生 AI。你拥有用户的日记记忆。
请根据以下日记内容回答用户的问题。如果日记中没有相关信息，请委婉说明。
回答要极简、亲切、有温度。

用户日记记忆：
${context}

用户问题：${query}`,
      });

      const answer = response.text?.trim() || '抱歉，我没能从记忆中找到相关信息。';
      
      if (isChat) {
        setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
      } else {
        setAiAnswer(answer);
      }
    } catch (err) {
      console.error('AI Query failed:', err);
      const errorMsg = 'AI 暂时无法连接到记忆库。';
      if (isChat) setChatHistory(prev => [...prev, { role: 'ai', text: errorMsg }]);
      else setAiAnswer(errorMsg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateMoodEmoji = async (text: string) => {
    if (!text || text.length < 5) return;
    
    const ai = getAI();
    if (!ai) {
      setMoodEmoji('✨');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `根据以下日记内容，返回一个最能代表今天心情的单个Emoji表情。只返回Emoji，不要任何文字。内容：${text}`,
      });
      const emoji = response.text?.trim() || '✨';
      setMoodEmoji(emoji);
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelect = (entry: DiaryEntry) => {
    setSelectedId(entry.id);
    setTitle(entry.title || '');
    setContent(entry.content || '');
    setMoodEmoji(entry.mood_emoji || '');
    setWeather(entry.weather || '');
    setImageData(entry.image_data || '');
    setAiAnswer(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleNew = () => {
    setSelectedId(null);
    setTitle('');
    setContent('');
    setMoodEmoji('');
    setImageData('');
    setAiAnswer(null);
    fetchWeather();
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSave = async () => {
    if (!title && !content) return;
    setIsSaving(true);
    
    let finalEmoji = moodEmoji;
    if (!finalEmoji && content.length > 10) {
      await generateMoodEmoji(content);
    }

    try {
      const entryData = {
        title: title || '无标题',
        content: content || '',
        mood_emoji: moodEmoji || '',
        weather: weather || '',
        image_data: imageData || '',
        date: new Date().toISOString(),
      };

      if (selectedId) {
        const updatedEntry = await diaryApi.updateEntry(selectedId, entryData);
        setEntries(entries.map(e => e.id === selectedId ? updatedEntry : e));
      } else {
        const savedEntry = await diaryApi.createEntry(entryData);
        setEntries([savedEntry, ...entries]);
        setSelectedId(savedEntry.id);
      }
    } catch (err: any) {
      console.error('Failed to save entry:', err);
      alert('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImageData(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这篇日记吗？')) return;
    
    try {
      await diaryApi.deleteEntry(id);
      setEntries(entries.filter(e => e.id !== id));
      if (selectedId === id) {
        handleNew();
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.endsWith('?') || val.endsWith('？')) {
      handleAiQuery(val);
    } else {
      setAiAnswer(null);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLunarDate = () => {
    const solar = Solar.fromDate(new Date());
    const lunar = Lunar.fromSolar(solar);
    return `农历 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(date);
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    setChatMessage('');
    handleAiQuery(msg, true);
  };

  return (
    <div className="flex h-screen bg-cream-100 text-ink overflow-hidden selection:bg-cream-400">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm border border-cream-300"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            />
            <motion.aside 
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed md:relative h-full w-[320px] bg-cream-200 border-r border-cream-300 flex-shrink-0 flex flex-col z-40 shadow-2xl md:shadow-none"
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="serif text-2xl font-semibold tracking-tight">私人情绪树洞</h1>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className={`p-2 rounded-full transition-colors ${isChatOpen ? 'bg-ink text-cream-100' : 'hover:bg-cream-300'}`}
                      title="数字孪生 AI"
                    >
                      <Zap size={20} />
                    </button>
                    <button 
                      onClick={handleNew}
                      className="p-2 hover:bg-cream-300 rounded-full transition-colors"
                      title="新建日记"
                    >
                      <Plus size={22} />
                    </button>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
                  <input 
                    type="text"
                    placeholder="搜索或提问 (以?结尾)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiQuery(searchQuery)}
                    className="w-full pl-10 pr-4 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cream-500 transition-all"
                  />
                </div>

                <AnimatePresence>
                  {aiAnswer && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-ink text-cream-100 rounded-xl text-xs leading-relaxed shadow-lg relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-1 opacity-20">
                        <Sparkles size={12} />
                      </div>
                      {aiAnswer}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-12 opacity-40">
                      <Book className="mx-auto mb-2" size={32} />
                      <p className="text-sm">尚无日记记录</p>
                    </div>
                  ) : (
                    filteredEntries.map((entry) => (
                      <motion.div
                        layout
                        key={entry.id}
                        onClick={() => handleSelect(entry)}
                        className={`group relative p-4 rounded-2xl cursor-pointer transition-all ${
                          selectedId === entry.id 
                            ? 'bg-white shadow-sm border border-cream-300' 
                            : 'hover:bg-cream-300/50 border border-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest text-ink-muted font-semibold">
                              {formatShortDate(entry.date)}
                            </span>
                            {entry.mood_emoji && <span className="text-xs">{entry.mood_emoji}</span>}
                          </div>
                          <button 
                            onClick={(e) => handleDelete(entry.id, e)}
                            className={`p-1 hover:text-red-500 transition-all ${
                              selectedId === entry.id 
                                ? 'opacity-100' 
                                : 'opacity-0 group-hover:opacity-100 md:opacity-0'
                            } md:group-hover:opacity-100`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <h3 className="serif text-lg font-medium truncate mb-1">
                          {entry.title || '无标题'}
                        </h3>
                        <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                          {entry.content || '暂无内容...'}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative bg-cream-50/50 w-full">
        {/* Header */}
        <header className="h-16 border-b border-cream-200 flex items-center justify-between px-4 md:px-8 bg-white/40 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-8 md:hidden" /> {/* Spacer for menu button */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-ink-muted">
                <Calendar size={14} />
                <span className="text-[10px] md:text-xs font-medium truncate max-w-[120px] md:max-w-none">
                  {selectedId ? formatDate(entries.find(e => e.id === selectedId)?.date || '') : formatDate(new Date().toISOString())}
                </span>
                {!selectedId && <span className="hidden md:inline text-[10px] opacity-60 ml-1">{getLunarDate()}</span>}
              </div>
              {!selectedId && warmTip && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[9px] md:text-[10px] text-ink-muted italic mt-0.5 line-clamp-1"
                >
                  {warmTip}
                </motion.span>
              )}
            </div>
            {weather && (
              <div className="hidden lg:flex items-center gap-2 text-ink-muted border-l border-cream-300 pl-6">
                <Cloud size={14} />
                <span className="text-xs font-medium">{weather}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {selectedId && (
              <button 
                onClick={(e) => handleDelete(selectedId, e as any)}
                className="p-2 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                title="删除此篇"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={() => generateMoodEmoji(content)}
              disabled={isAnalyzing || !content}
              className="p-2 text-ink-muted hover:text-ink hover:bg-cream-200 rounded-full transition-all disabled:opacity-30"
              title="AI 分析心情"
            >
              <Sparkles size={18} className={isAnalyzing ? 'animate-pulse' : ''} />
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-medium transition-all ${
                isSaving 
                  ? 'bg-cream-300 text-ink-muted cursor-not-allowed' 
                  : 'bg-ink text-cream-100 hover:bg-ink/90 shadow-md'
              }`}
            >
              <Save size={16} />
              <span className="hidden xs:inline">{isSaving ? '保存中...' : '保存日记'}</span>
              <span className="xs:hidden">{isSaving ? '...' : '保存'}</span>
            </motion.button>
          </div>
        </header>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6 md:p-16 flex justify-center">
          <div className="w-full max-w-2xl flex flex-col">
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <input 
                type="text"
                placeholder="给今天起个名字..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="serif text-3xl md:text-5xl font-semibold bg-transparent border-none focus:outline-none placeholder:opacity-20 flex-1"
              />
              <AnimatePresence>
                {moodEmoji && (
                  <motion.div 
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="text-3xl md:text-5xl"
                  >
                    {moodEmoji}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {imageData && (
              <div className="relative mb-6 md:mb-8 group">
                <img 
                  src={imageData} 
                  alt="Diary entry" 
                  className="w-full rounded-2xl shadow-sm border border-cream-300"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setImageData('')}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <textarea
              ref={contentRef}
              placeholder="记录下此刻的心情与故事... (支持粘贴图片)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              className="flex-1 bg-transparent border-none focus:outline-none resize-none text-base md:text-xl leading-relaxed placeholder:opacity-20 min-h-[400px]"
            />
          </div>
        </div>

        {/* AI Chat Bubble (Digital Twin) */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-4 right-4 left-4 md:left-auto md:bottom-8 md:right-8 md:w-80 h-[70vh] md:h-96 bg-white rounded-3xl shadow-2xl border border-cream-300 flex flex-col overflow-hidden z-50"
            >
              <div className="p-4 bg-ink text-cream-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-yellow-400" />
                  <span className="text-sm font-semibold">数字孪生 AI</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="opacity-60 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center py-8 opacity-40 text-xs">
                    你可以问我关于你日记中的任何事，<br/>我会帮你回忆。
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user' ? 'bg-cream-300 text-ink' : 'bg-cream-100 text-ink-muted'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-cream-100 p-3 rounded-2xl">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-ink-muted rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-ink-muted rounded-full animate-bounce delay-75" />
                        <div className="w-1 h-1 bg-ink-muted rounded-full animate-bounce delay-150" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-cream-200 flex gap-2">
                <input 
                  type="text"
                  placeholder="问问你的记忆..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  className="flex-1 bg-cream-50 border border-cream-300 rounded-full px-4 py-2 text-xs focus:outline-none"
                />
                <button 
                  onClick={sendChatMessage}
                  className="p-2 bg-ink text-cream-100 rounded-full hover:bg-ink/90 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decorative Elements */}
        <div className="absolute bottom-8 right-8 pointer-events-none opacity-10">
          <Book size={120} />
        </div>
      </main>
    </div>
  );
}
