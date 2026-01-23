import React from 'react';

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
        <div className="p-8 text-white bg-red-900/20 h-full overflow-auto">
          <h1 className="text-2xl font-bold mb-4">页面发生错误</h1>
          <div className="bg-black/50 p-4 rounded-lg font-mono text-sm mb-4 border border-red-500/30">
            <p className="text-red-300 font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
            <pre className="text-zinc-400 whitespace-pre-wrap">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold"
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
