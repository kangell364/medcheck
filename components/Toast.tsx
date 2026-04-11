'use client'

import { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  message: string
  type?: 'success' | 'error' | 'info'
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => setVisible(true), 10)

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300) // wait for exit animation
    }, 4000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [toast.id, onDismiss])

  const bgColor =
    toast.type === 'error'
      ? 'bg-red-600'
      : toast.type === 'info'
      ? 'bg-blue-600'
      : 'bg-emerald-600'

  return (
    <div
      className={`pointer-events-auto ${bgColor} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {toast.message}
    </div>
  )
}

// Hook for easy toast management
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  function addToast(message: string, type: ToastMessage['type'] = 'success') {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, addToast, dismissToast }
}
