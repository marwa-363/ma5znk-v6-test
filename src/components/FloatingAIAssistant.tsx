import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BarChart2, X, MessageSquare, ChevronDown, Maximize2, Minimize2, TrendingUp, Package, Wallet, Mic, MicOff } from 'lucide-react';
import { generateFinancialResponse, financialTools } from '../services/gemini';
import { translations } from '../translations';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { getCollection } from '../services/accountingService';
import { Invoice } from '../types';
import toast from 'react-hot-toast';
import { useVoiceInput } from '../hooks/useVoiceInput';
import Button from './Button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
  chartData?: any;
}

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function FloatingAIAssistant({ lang, profile }: Props) {
  const t = translations[lang];
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: lang === 'ar' ? 'مرحباً! أنا مساعدك المالي الذكي. كيف يمكنني مساعدتك اليوم؟' : 'Hello! I am your AI financial assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isListening, transcript, startListening, stopListening } = useVoiceInput(lang);

  useEffect(() => {
    if (transcript) {
      setInput(prev => prev + ' ' + transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (overrideInput?: string) => {
    const messageToSend = overrideInput || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = messageToSend.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const currentMessages = newMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      }));

      const response = await generateFinancialResponse(currentMessages, profile?.companyId || 'default');
      
      let finalContent = response.text || '';
      let chartData = null;
      const chartMatch = finalContent.match(/CHART_DATA:\s*(\[.*\])/s);
      if (chartMatch) {
        try {
          chartData = JSON.parse(chartMatch[1]);
          finalContent = finalContent.replace(/CHART_DATA:\s*\[.*\]/s, '').trim();
        } catch (e) {
          console.error('Failed to parse chart data', e);
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: finalContent, chartData }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'ar' ? 'عذراً، حدث خطأ.' : 'Sorry, an error occurred.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedActions = [
    { id: 'sales_today', label: lang === 'ar' ? 'عرض مبيعات اليوم' : 'View Today\'s Sales', icon: TrendingUp },
    { id: 'top_products', label: lang === 'ar' ? 'أعلى المنتجات مبيعًا' : 'Top Selling Products', icon: Package },
    { id: 'treasury_balance', label: lang === 'ar' ? 'رصيد الخزينة الحالي' : 'Current Treasury Balance', icon: Wallet },
  ];

  return (
    <div className={`fixed bottom-6 ${lang === 'ar' ? 'left-6' : 'right-6'} z-[100]`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`
              bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] shadow-2xl rounded-[2rem] overflow-hidden flex flex-col
              ${isMinimized ? 'h-16 w-64' : 'h-[550px] w-[350px] sm:w-[380px]'}
              fixed bottom-24 ${lang === 'ar' ? 'left-6' : 'right-6'}
              max-sm:fixed max-sm:inset-0 max-sm:w-full max-sm:h-full max-sm:rounded-none
            `}
          >
            {/* Header */}
            <div className="p-4 bg-[var(--color-primary)] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm block leading-none">{lang === 'ar' ? 'المساعد المالي' : 'Financial Assistant'}</span>
                  <span className="text-[10px] opacity-80">{lang === 'ar' ? 'متصل الآن' : 'Online'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setIsMinimized(!isMinimized)} 
                  variant="secondary"
                  size="sm"
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors bg-transparent border-none text-white"
                  leftIcon={isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                />
                <Button 
                  onClick={() => setIsOpen(false)} 
                  variant="secondary"
                  size="sm"
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors bg-transparent border-none text-white"
                  leftIcon={<X className="w-4 h-4" />}
                />
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-[var(--color-primary)] text-white rounded-tr-none' 
                          : 'bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-tl-none'
                      }`}>
                        <div className="prose dark:prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.chartData && (
                          <div className="mt-4 h-32 w-full bg-white dark:bg-zinc-900 rounded-xl p-2 border border-zinc-200 dark:border-zinc-700">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={msg.chartData}>
                                <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] rounded-2xl animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Actions */}
                {messages.length === 1 && !isLoading && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {suggestedActions.map((action) => (
                      <Button
                        key={action.id}
                        onClick={() => handleSend(action.label)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-full text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
                        leftIcon={<action.icon className="w-3 h-3" />}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder={lang === 'ar' ? 'اسألني أي شيء...' : 'Ask me anything...'}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="w-full pl-4 pr-12 py-3 bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-xl text-sm focus:ring-2 ring-[var(--color-primary)]/20 outline-none"
                      />
                      <Button 
                        onClick={() => handleSend()}
                        disabled={isLoading}
                        variant="primary"
                        size="sm"
                        className={`absolute ${lang === 'ar' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--color-primary)] text-white rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-[var(--color-primary-hover)] transition-colors`}
                        leftIcon={<Send className="w-4 h-4" />}
                      />
                    </div>
                    <Button
                      onClick={isListening ? stopListening : startListening}
                      variant="secondary"
                      size="sm"
                      className={`p-3 rounded-xl transition-all ${
                        isListening 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : 'bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                      }`}
                      title={lang === 'ar' ? 'تحدث' : 'Speak'}
                      leftIcon={isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="primary"
        className="w-14 h-14 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center shadow-2xl shadow-[var(--color-primary)]/40"
        leftIcon={isOpen ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      />
    </div>
  );
}
