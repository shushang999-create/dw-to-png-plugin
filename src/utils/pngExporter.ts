import html2canvas from 'html2canvas';
import { ExportOptions } from '../types';
import errorCollector from './errorCollector';

/**
 * 显示消息提示
 */
function showMessage(message: string, type: 'success' | 'error'): void {
  const messageEl = document.createElement('div');
  const bgColor = type === 'success' ? '#52c41a' : '#ff4d4f';
  
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
  `;
  messageEl.textContent = message;
  document.body.appendChild(messageEl);

  // 3秒后自动移除
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, 3000);
}

/**
 * 导出表格为PNG图片
 */
export async function exportToPNG(
  elementId: string, 
  options: ExportOptions
): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`找不到元素: ${elementId}`);
  }

  try {
    // 显示加载状态
    showLoading('正在生成图片...');

    // 配置html2canvas选项
    const canvasOptions = {
      backgroundColor: options.theme === 'dark' ? '#1f1f1f' : '#ffffff',
      scale: 2, // 提高图片清晰度
      useCORS: true,
      allowTaint: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc: Document) => {
        // 在克隆的文档中优化样式
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // 移除滚动条
          clonedElement.style.overflow = 'visible';
          // 移除容器边框，防止最后一列出现浅色竖线
          clonedElement.style.border = 'none';
          
          // 确保所有内容都可见
          const clonedTable = clonedElement.querySelector('table');
          if (clonedTable) {
            clonedTable.style.width = 'auto';
            clonedTable.style.tableLayout = 'fixed';
            
            // 确保表头文字居中并修复最后一列边框
            const headers = clonedTable.querySelectorAll('th');
            headers.forEach((header, index) => {
              (header as HTMLElement).style.textAlign = 'center';
              (header as HTMLElement).style.verticalAlign = 'middle';
              // 修复最后一列右边框
              if (index === headers.length - 1) {
                (header as HTMLElement).style.borderRight = 'none';
              }
            });
            
            // 确保所有单元格垂直居中、居中对齐并修复最后一列边框
            const rows = clonedTable.querySelectorAll('tbody tr');
            rows.forEach((row) => {
              const cells = row.querySelectorAll('td');
              cells.forEach((cell, cellIndex) => {
                (cell as HTMLElement).style.verticalAlign = 'middle';
                (cell as HTMLElement).style.textAlign = 'center';
                // 修复最后一列右边框
                if (cellIndex === cells.length - 1) {
                  (cell as HTMLElement).style.borderRight = 'none';
                }
              });
            });
          }
        }
      }
    };

    // 生成canvas
    const canvas = await html2canvas(element, canvasOptions);
    
    // 返回Promise，确保函数等待异步操作完成
    return new Promise((resolve) => {
      // 转换为blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          
          // 下载图片
          const link = document.createElement('a');
          link.href = url;
          link.download = generateFileName();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          hideLoading();
          showSuccess('图片导出成功！');
          
          URL.revokeObjectURL(url);
          resolve({ success: true, imageUrl: url, message: '图片导出成功' });
        } else {
          hideLoading();
          showError('图片生成失败，请重试');
          resolve({ success: false, message: '图片生成失败' });
        }
      }, 'image/png', 0.95);
    });

  } catch (error) {
    hideLoading();
    errorCollector.captureExportError(
      '瀵煎嚭PNG澶辫触',
      { 
        error: error as Error,
        details: { stack: (error as Error).stack }
      }
    );
    showError('瀵煎嚭澶辫触锛?' + (error as Error).message);
    return { success: false, message: '瀵煎嚭澶辫触锛?' + (error as Error).message };
  }
}

/**
 * 生成文件名
 */
function generateFileName(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `table-export-${timestamp}.png`;
}

/**
 * 显示加载状态
 */
function showLoading(message: string): void {
  hideLoading(); // 先移除已存在的loading
  
  const loadingEl = document.createElement('div');
  loadingEl.id = 'export-loading';
  loadingEl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px 30px;
    border-radius: 8px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
  `;
  loadingEl.textContent = message;
  document.body.appendChild(loadingEl);
}

/**
 * 隐藏加载状态
 */
function hideLoading(): void {
  const loadingEl = document.getElementById('export-loading');
  if (loadingEl) {
    loadingEl.remove();
  }
}

/**
 * 显示成功消息
 */
function showSuccess(message: string): void {
  showMessage(message, 'success');
}

/**
 * 显示错误消息
 */
function showError(message: string): void {
  showMessage(message, 'error');
}

/**
 * 检查浏览器兼容性
 */
export function checkBrowserCompatibility(): { compatible: boolean; message?: string } {
  // 检查必要的API支持
  if (!document.getElementById) {
    return { compatible: false, message: '浏览器不支持DOM操作' };
  }

  if (!window.URL || !window.URL.createObjectURL) {
    return { compatible: false, message: '浏览器不支持文件下载功能' };
  }

  if (!window.HTMLCanvasElement) {
    return { compatible: false, message: '浏览器不支持Canvas功能' };
  }

  // 检查文件大小限制
  const canvas = document.createElement('canvas');
  const testSize = 10000; // 10K像素测试
  try {
    canvas.width = testSize;
    canvas.height = testSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { compatible: false, message: '浏览器不支持Canvas 2D渲染' };
    }
  } catch (error) {
    return { compatible: false, message: '浏览器Canvas功能受限' };
  }

  return { compatible: true };
}
