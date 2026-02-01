// Toast notification helper
// Uses window.showToast if available, otherwise logs to console

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ShowToastWindow extends Window {
  showToast?: (message: string, type: ToastType) => void;
}

export function showToast(message: string, type: ToastType = 'info'): void {
  if (typeof window !== 'undefined') {
    const win = window as ShowToastWindow;
    if (win.showToast) {
      win.showToast(message, type);
    } else {
      // Fallback to console
      const prefix = type === 'error' ? 'ERROR' : type === 'warning' ? 'WARN' : 'INFO';
      console.log(`[${prefix}] ${message}`);
    }
  }
}

export function showSuccessToast(message: string): void {
  showToast(message, 'success');
}

export function showErrorToast(message: string): void {
  showToast(message, 'error');
}

export function showWarningToast(message: string): void {
  showToast(message, 'warning');
}

export function showInfoToast(message: string): void {
  showToast(message, 'info');
}
