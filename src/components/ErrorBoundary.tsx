/** React 错误边界：任何组件崩溃不白屏，提供一键恢复 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  /** 恢复动作标签 */
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private recover = (): void => {
    this.setState({ error: null });
  };

  private recoverReload = (): void => {
    // 深度恢复：重载整个前端（故事数据在 SQLite，不丢失）
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'var(--bg, #fff)',
            color: 'var(--text, #303133)',
            fontFamily: '"Microsoft YaHei", sans-serif',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40 }}>🌙</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>DCR 做了一个噩梦，但你的故事安然无恙。</div>
          <div style={{ fontSize: 13, color: 'var(--sub, #909399)', maxWidth: 480, wordBreak: 'break-all' }}>
            {this.state.error.message}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.recover}
              style={{
                border: 0,
                background: 'var(--accent, #F0655A)',
                color: '#fff',
                padding: '10px 26px',
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {this.props.fallbackLabel ?? '回到编辑器'}
            </button>
            <button
              onClick={this.recoverReload}
              style={{
                border: '1px solid var(--border, #EAEAEA)',
                background: 'transparent',
                color: 'var(--text, #303133)',
                padding: '10px 26px',
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重载应用
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
