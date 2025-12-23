// 错误严重程度枚举
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 错误日志接口
export interface ErrorLog {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, any>;
  stackTrace?: string;
  context?: Record<string, any>;
}

// 错误收集器类
class ErrorCollector {
  private errorLogs: ErrorLog[] = [];
  private maxLogs = 1000; // 最大日志数量

  // 记录错误
  logError(
    severity: ErrorSeverity,
    message: string,
    options?: {
      details?: Record<string, any>;
      error?: Error;
      context?: Record<string, any>;
    }
  ): string {
    const { details, error, context } = options || {};
    
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      severity,
      message,
      details,
      stackTrace: error?.stack,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        language: navigator.language,
        url: window.location.href
      }
    };
    
    this.errorLogs.push(errorLog);
    
    // 限制日志数量
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift(); // 移除最旧的日志
    }
    
    // 控制台输出
    this.consoleLog(errorLog);
    
    return errorLog.id;
  }
  
  // 生成唯一ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  // 控制台输出
  private consoleLog(errorLog: ErrorLog): void {
    const { severity, message, details, stackTrace } = errorLog;
    const prefix = `[${severity.toUpperCase()}] ${message}`;
    
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error(prefix, details || '', stackTrace || '');
        break;
      case ErrorSeverity.WARNING:
        console.warn(prefix, details || '');
        break;
      case ErrorSeverity.INFO:
        console.info(prefix, details || '');
        break;
    }
  }
  
  // 获取所有错误日志
  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }
  
  // 根据严重程度获取错误日志
  getErrorLogsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.errorLogs.filter(log => log.severity === severity);
  }
  
  // 清空所有错误日志
  clearErrorLogs(): void {
    this.errorLogs = [];
  }
  
  // 导出错误日志
  exportErrorLogs(): string {
    const dataStr = JSON.stringify(this.errorLogs, null, 2);
    return dataStr;
  }
  
  // 下载错误日志
  downloadErrorLogs(): void {
    const dataStr = this.exportErrorLogs();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // API错误捕获
  captureApiError(
    message: string,
    options?: {
      details?: Record<string, any>;
      error?: Error;
      context?: Record<string, any>;
      severity?: ErrorSeverity;
    }
  ): string {
    const { details, error, context, severity = ErrorSeverity.MEDIUM } = options || {};
    return this.logError(severity, message, { details, error, context });
  }

  // 导出错误捕获
  captureExportError(
    message: string,
    options?: {
      details?: Record<string, any>;
      error?: Error;
      context?: Record<string, any>;
    }
  ): string {
    const { details, error, context } = options || {};
    return this.logError(ErrorSeverity.ERROR, message, { details, error, context });
  }

  // 上报错误到服务器（如果需要）
  reportErrorToServer(): Promise<void> {
    // 这里可以实现错误上报逻辑
    // 例如：fetch('https://your-error-reporting-api.com/report', { method: 'POST', body: JSON.stringify(this.errorLogs) });
    return Promise.resolve();
  }
}

// 导出单例实例
export default new ErrorCollector();