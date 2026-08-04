import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Automatically dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const icon = {
              success: <CheckCircle className="w-5 h-5 text-emerald-600" />,
              warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
              error: <XCircle className="w-5 h-5 text-rose-600" />,
              info: <Info className="w-5 h-5 text-sky-600" />
            }[toast.type];

            const bgClass = {
              success: 'bg-emerald-50 border-emerald-100 text-emerald-900',
              warning: 'bg-amber-50 border-amber-100 text-amber-900',
              error: 'bg-rose-50 border-rose-100 text-rose-900',
              info: 'bg-sky-50 border-sky-100 text-sky-900'
            }[toast.type];

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${bgClass} pointer-events-auto`}
              >
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <div className="flex-1 text-sm font-medium">{toast.message}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
