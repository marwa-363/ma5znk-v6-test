import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BarChart2, TrendingUp, AlertTriangle, Mic, MicOff, X, ShieldAlert, ChevronLeft } from 'lucide-react';
import { generateFinancialResponse, financialTools } from '../services/gemini';
import { translations } from '../translations';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { getCollection } from '../services/accountingService';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/Button';
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

export default function AIAssistant({ lang, profile }: Props) {
  const { hasPermission } = useAuth();
  const t = translations[lang];

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: lang === 'ar' ? 'مرحباً! أنا مساعدك المالي الذكي. يمكنني تحليل مبيعاتك، مخزونك، وأرباحك. كيف يمكنني مساعدتك اليوم؟' : 'Hello! I am your AI financial assistant. I can analyze your sales, inventory, and profits. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!hasPermission('view_dashboard')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-10">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black mb-4">{t.accessDenied || (lang === 'ar' ? 'غير مصرح' : 'Unauthorized')}</h2>
        <p className="text-zinc-500 max-w-md">{lang === 'ar' ? 'عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة.' : 'Sorry, you do not have sufficient permissions to access this page.'}</p>
      </div>
    );
  }

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

      // Extract chart data if present
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
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'ar' ? 'عذراً، حدث خطأ أثناء معالجة طلبك.' : 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error(lang === 'ar' ? 'متصفحك لا يدعم التعرف على الصوت' : 'Your browser does not support speech recognition');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput(transcript);
        handleSend(transcript);
      }
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 z-[60] lg:z-0">
      {/* AI Header */}
      <div className="p-6 lg:p-8 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 dark:bg-primary/20 text-primary rounded-2xl shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-black tracking-tight">{t.aiAssistantTitle}</h2>
            <p className="text-xs lg:text-sm text-zinc-500 font-medium">{t.aiAssistantSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            System Online
          </div>
          <Button 
            variant="secondary"
            size="sm"
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-600 bg-transparent" 
            onClick={() => window.history.back()}
            leftIcon={<X className="w-6 h-6" />}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[90%] lg:max-w-[85%] flex gap-3 lg:gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-primary text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-primary'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 lg:w-6 lg:h-6" /> : <Bot className="w-5 h-5 lg:w-6 lg:h-6" />}
                </div>
                <div className="space-y-4 flex-1">
                  <div className={`p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                  }`}>
                    <div className="prose dark:prose-invert prose-emerald max-w-none font-medium leading-relaxed text-sm lg:text-base">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.chartData && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm h-[350px]"
                    >
                      <div className="flex items-center gap-2 mb-6 text-zinc-400 font-bold text-xs uppercase tracking-widest">
                        <BarChart2 className="w-4 h-4" />
                        {lang === 'ar' ? 'تحليل البيانات' : 'Data Analysis'}
                      </div>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={msg.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              borderRadius: '16px', 
                              border: 'none', 
                              boxShadow: '0 10px 30px -5px rgb(0 0 0 / 0.1)' 
                            }} 
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {msg.chartData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#059669'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-primary flex items-center justify-center shadow-sm">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" />
                  <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 lg:p-10 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 lg:gap-4 mb-4 lg:mb-6 overflow-x-auto pb-2 no-scrollbar">
            <SuggestionChip 
              label={lang === 'ar' ? 'مبيعات هذا الشهر' : 'Sales this month'} 
              onClick={() => handleSend(lang === 'ar' ? 'كم بلغت مبيعاتي هذا الشهر؟' : 'What are my sales this month?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'المنتجات الأكثر مبيعاً' : 'Best selling products'} 
              onClick={() => handleSend(lang === 'ar' ? 'ما هي أكثر المنتجات مبيعاً؟' : 'What are the best selling products?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'نقص المخزون' : 'Low stock alerts'} 
              onClick={() => handleSend(lang === 'ar' ? 'هل هناك منتجات منخفضة في المخزون؟' : 'Are there any low stock products?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'تحليل الأرباح' : 'Profit analysis'} 
              onClick={() => handleSend(lang === 'ar' ? 'حلل أرباحي للأسبوع الماضي' : 'Analyze my profits for the last week')} 
            />
          </div>
          <div className="relative group flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t.aiHint}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full pl-6 lg:pl-8 pr-16 lg:pr-20 py-4 lg:py-6 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] lg:rounded-[2rem] focus:ring-4 focus:ring-primary/10 outline-none text-base lg:text-lg font-medium transition-all"
              />
              <Button 
                onClick={() => handleSend()}
                disabled={isLoading}
                variant="primary"
                className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl shadow-2xl shadow-primary/20"
                leftIcon={<Send className="w-5 h-5 lg:w-6 lg:h-6" />}
              />
            </div>
            <Button 
              onClick={startListening}
              disabled={isLoading}
              variant="secondary"
              className={`w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.5rem] shadow-sm ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              leftIcon={isListening ? <MicOff className="w-5 h-5 lg:w-6 lg:h-6" /> : <Mic className="w-5 h-5 lg:w-6 lg:h-6" />}
            />
          </div>
          <div className="mt-4 lg:mt-6 flex items-center justify-center gap-3 text-[8px] lg:text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Makhzanak Intelligence Engine
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <Button 
      onClick={onClick}
      variant="secondary"
      className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-primary/10 dark:hover:bg-primary/20 text-zinc-600 dark:text-zinc-400 hover:text-primary rounded-2xl text-xs font-bold whitespace-nowrap transition-all border border-transparent hover:border-primary/20 dark:hover:border-primary/80"
    >
      {label}
    </Button>
  );
}
