import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  lang: 'ar' | 'en';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger',
  lang
}: ConfirmModalProps) {
  const isAr = lang === 'ar';

  const footer = (
    <div className="flex gap-3 w-full">
      <Button
        onClick={onClose}
        variant="secondary"
        className="flex-1"
        size="lg"
      >
        {cancelText || (isAr ? 'إلغاء' : 'Cancel')}
      </Button>
      <Button
        onClick={() => {
          onConfirm();
          onClose();
        }}
        variant={type === 'danger' ? 'danger' : 'primary'}
        className="flex-1"
        size="lg"
      >
        {confirmText || (isAr ? 'تأكيد' : 'Confirm')}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={footer}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`p-4 rounded-2xl mb-6 ${
          type === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' :
          type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20' :
          'bg-blue-100 text-blue-600 dark:bg-blue-900/20'
        }`}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
          {message}
        </p>
      </div>
    </Modal>
  );
}
