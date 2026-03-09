import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * ErrorBoundary wrapping lazy-loaded chunks.
 * Detects failed dynamic import (chunk load error) and shows a
 * user-friendly reload prompt instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  declare props: Readonly<Props>;
  state: State = { hasError: false, isChunkError: false };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    // Vite chunk-load errors typically contain "dynamically imported module"
    // or "Failed to fetch" or "Loading chunk" etc.
    const isChunkError =
      /dynamically imported module|failed to fetch|loading chunk|load_failed/i.test(message);
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  private handleReload = () => {
    // Hard-reload to re-fetch latest chunks from server
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center animate-fade-in">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: '#FFF3E8' }}
        >
          <WifiOff className="w-7 h-7" style={{ color: '#D9730D' }} />
        </div>

        <h2 className="text-lg font-semibold mb-2" style={{ color: '#1A1A1A' }}>
          {this.state.isChunkError ? 'Không tải được trang' : 'Đã xảy ra lỗi'}
        </h2>

        <p className="text-sm mb-6 max-w-xs" style={{ color: '#787774' }}>
          {this.state.isChunkError
            ? 'Kết nối mạng yếu hoặc ứng dụng vừa được cập nhật. Hãy tải lại trang để tiếp tục.'
            : 'Một lỗi không mong muốn đã xảy ra. Hãy thử tải lại trang.'}
        </p>

        <button
          onClick={this.handleReload}
          className="btn btn-primary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Tải lại trang
        </button>
      </div>
    );
  }
}
