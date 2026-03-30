import React, { useState } from 'react';
import { Mail, Lock, User, Loader2, Package } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { translations } from '../translations';
import Modal from './Modal';
import Button from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export default function AuthModal({ isOpen, onClose, lang }: Props) {
  console.log("AuthModal rendering, isOpen:", isOpen);
  const t = translations[lang];
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setError(lang === 'ar' 
          ? 'يرجى تفعيل (Email/Password) و (Google) في لوحة تحكم Firebase (Authentication > Sign-in method)' 
          : 'Please enable both Email/Password and Google Sign-In in your Firebase Console (Authentication > Sign-in method)');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(lang === 'ar'
          ? 'هذا النطاق غير مصرح به. يرجى إضافة رابط الموقع إلى (Authorized domains) في إعدادات Firebase Authentication.'
          : 'This domain is not authorized. Please add this URL to "Authorized domains" in your Firebase Authentication settings.');
      } else {
        setError(err.message || t.errorLoginFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        if (!name) throw new Error(lang === 'ar' ? 'يرجى إدخال الاسم' : 'Please enter your name');
        await signUpWithEmail(email, password, name);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setError(lang === 'ar' 
          ? 'يرجى تفعيل (Email/Password) و (Google) في لوحة تحكم Firebase (Authentication > Sign-in method)' 
          : 'Please enable both Email/Password and Google Sign-In in your Firebase Console (Authentication > Sign-in method)');
      } else {
        setError(err.message || (isLogin ? t.errorLoginFailed : t.errorRegistrationFailed));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title=""
      showCloseButton={true}
    >
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
            <Package className="w-6 h-6" />
          </div>
          <span className="text-xl font-black text-primary tracking-tighter">{t.brand}</span>
        </div>

        <div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">
            {isLogin ? t.login : t.register}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {isLogin ? t.heroSub : t.createAccount}
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="secondary"
            className="w-full py-4 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 hover:border-primary dark:hover:border-primary rounded-2xl font-bold shadow-sm"
            leftIcon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" referrerPolicy="no-referrer" />}
          >
            <span className="text-zinc-700 dark:text-zinc-200">{lang === 'ar' ? 'تسجيل الدخول بجوجل' : 'Sign in with Google'}</span>
          </Button>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700"></div>
            <span className="flex-shrink mx-4 text-zinc-400 text-xs font-bold uppercase tracking-widest">{lang === 'ar' ? 'أو' : 'OR'}</span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary transition-all font-medium"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary transition-all font-medium"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="password"
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary transition-all font-medium"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full py-4 rounded-2xl font-bold"
              leftIcon={loading && <Loader2 className="w-5 h-5 animate-spin" />}
            >
              {!loading && (isLogin ? t.login : t.register)}
            </Button>
          </form>

          {error && (
            <p className="text-sm font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <Button
            onClick={() => setIsLogin(!isLogin)}
            variant="secondary"
            className="w-full text-sm font-bold text-zinc-500 hover:text-primary bg-transparent"
          >
            {isLogin ? t.noAccount : t.haveAccount}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
