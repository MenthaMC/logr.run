import React from 'react';
import { Button } from '@/lib/ui';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary 捕获到异常', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#0a0b0d] text-zinc-300 p-6">
          <div className="page-card w-full max-w-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-bold mb-4 text-white">页面发生错误</h1>
            <div className="bg-black/40 p-4 rounded-xl font-mono text-sm mb-6 border border-red-500/25">
              <p className="text-red-300 font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
              <pre className="text-zinc-400 whitespace-pre-wrap">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
            </div>
            <Button
              color="primary"
              onPress={() => window.location.reload()}
              className="page-button-primary px-5 py-2.5 font-semibold"
            >
              刷新页面
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
