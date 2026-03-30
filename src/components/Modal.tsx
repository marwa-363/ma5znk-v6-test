import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  closeOnOutsideClick = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'md:w-[400px]';
      case 'md': return 'md:w-[600px]';
      case 'lg': return 'md:w-[800px]';
      case 'xl': return 'md:w-[1000px]';
      default: return 'md:w-[600px]';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOutsideClick ? onClose : undefined}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`
              relative bg-white dark:bg-zinc-900 shadow-2xl 
              w-full h-full md:h-auto md:min-h-[60vh] md:max-h-[90vh] 
              flex flex-col overflow-hidden
              md:rounded-[2rem] border border-zinc-200 dark:border-zinc-800
              ${getSizeClass()}
              max-w-full md:max-w-[90%]
              laptop:!transform-none
            `}
            ref={modalRef}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-8 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h3 className="text-lg md:text-2xl font-bold text-zinc-900 dark:text-white">
                {title}
              </h3>
              {showCloseButton && (
                <Button
                  variant="icon"
                  onClick={onClose}
                  leftIcon={<X size={20} className="md:w-6 md:h-6" />}
                />
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar modal-body-content">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 md:p-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 items-center justify-end sticky bottom-0 bg-white dark:bg-zinc-900 z-10">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
