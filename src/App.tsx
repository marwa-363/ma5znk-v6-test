import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import { motion, AnimatePresence } from 'motion/react';
import { ensureSystemAccounts } from './services/accountingService';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    const saved = localStorage.getItem('makhzanak-lang');
    return (saved as 'ar' | 'en') || 'ar';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('makhzanak-theme');
    return (saved as 'light' | 'dark') || 'light';
  });
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    return localStorage.getItem('makhzanak-compact') === 'true';
  });
  const [browserMode, setBrowserMode] = useState<boolean>(() => {
    return localStorage.getItem('makhzanak-browser-mode') === 'true';
  });

  useEffect(() => {
    if (user && profile?.companyId) {
      ensureSystemAccounts(profile.companyId).catch(console.error);
    }
  }, [user, profile?.companyId]);

  useEffect(() => {
    if (browserMode) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setTheme(e.matches ? 'dark' : 'light');
      };
      setTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [browserMode]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('makhzanak-lang', lang);
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('makhzanak-theme', theme);

    if (compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
    localStorage.setItem('makhzanak-compact', compactMode.toString());
    localStorage.setItem('makhzanak-browser-mode', browserMode.toString());
  }, [lang, theme, compactMode, browserMode]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-3xl font-bold text-primary font-sans"
        >
          مخزنك
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)] transition-colors duration-300">
      <Toaster position="top-center" reverseOrder={false} />
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LandingPage lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DashboardLayout 
              lang={lang} 
              setLang={setLang} 
              theme={theme} 
              setTheme={setTheme}
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              browserMode={browserMode}
              setBrowserMode={setBrowserMode}
              profile={profile}
              onSignOut={signOut}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
