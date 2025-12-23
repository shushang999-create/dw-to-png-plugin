import { bitable, FieldType, ITable } from '@lark-base-open/js-sdk';
import errorCollector, { ErrorSeverity } from './errorCollector';

/**
 * 通用错误类型定义
 */
type OperationError = {
  success: false;
  message: string;
};

/**
 * 成功结果类型定义
 */
type OperationSuccess<T = void> = {
  success: true;
  message: string;
} & T;

/**
 * 操作结果类型定义
 */
type OperationResult<T = void> = OperationSuccess<T> | OperationError;

/**
 * 表格信息类型
 */
type TableInfo = {
  id: string;
  name: string;
};

/**
 * 将URL下载为Blob对象
 * @param url 图片URL
 * @returns Blob对象
 */
async function downloadImageAsBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.blob();
  } catch (error) {
    errorCollector.captureApiError(
      '涓嬭浇鍥剧墖澶辫触',
      { error: error as Error, severity: ErrorSeverity.MEDIUM }
    );
    throw new Error(`下载图片失败: ${(error as Error).message}`);
  }
}

/**
 * 获取指定或活跃的数据表
 * @param tableId 数据表ID（可选）
 * @returns 数据表实例
 */
async function getTargetTable(tableId?: string): Promise<ITable> {
  try {
    const base = bitable.base;
    const table = tableId 
      ? await base.getTable(tableId)
      : await base.getActiveTable();
    
    if (!table) {
      throw new Error(tableId ? `未找到ID为${tableId}的数据表` : '未找到活跃数据表');
    }
    return table;
  } catch (error) {
    errorCollector.captureApiError(
      '鑾峰彇鏁版嵁琛ㄥけ璐?',      
      { error: error as Error, severity: ErrorSeverity.HIGH }
    );
    throw new Error(`获取数据表失败: ${(error as Error).message}`);
  }
}

/**
 * 确保数据表中存在附件字段
 * @param table 数据表实例
 * @returns 附件字段ID
 */
async function ensureAttachmentFieldExists(table: ITable): Promise<string> {
  try {
    // 获取现有附件字段
    const fieldMetaList = await table.getFieldMetaList();
    const existingField = fieldMetaList.find(meta => meta.type === FieldType.Attachment);
    
    if (existingField) {
      return existingField.id;
    }
    
    // 创建新的附件字段
    const newField = await table.addField({
      name: '图片附件',
      type: FieldType.Attachment
    });
    
    return newField as string;
  } catch (error) {
    errorCollector.captureApiError(
      '处理附件字段失败',
      { error: error as Error, severity: ErrorSeverity.MEDIUM }
    );
    throw new Error(`处理附件字段失败: ${(error as Error).message}`);
  }
}

/**
 * 将文件添加到指定数据表
 * @param table 数据表实例
 * @param file 要添加的文件
 * @param attachmentFieldId 附件字段ID
 * @returns 添加结果
 */
async function addFileToTable(
  table: ITable,
  file: File,
  attachmentFieldId: string
): Promise<string> {
  try {
    // 先获取字段实例，然后使用createCell方法创建正确的单元格值
    const attachmentField = await table.getField(attachmentFieldId);
    const attachmentCell = await attachmentField.createCell(file);
    
    // 使用正确的单元格值创建记录
    const recordId = await table.addRecord(attachmentCell);
    return recordId;
  } catch (error) {
    errorCollector.captureApiError(
      '添加文件到数据表失败',
      { error: error as Error, severity: ErrorSeverity.MEDIUM }
    );
    throw new Error(`添加文件到数据表失败: ${(error as Error).message}`);
  }
}

/**
 * 生成HTML元素的截图
 * @param elementId 元素ID
 * @param options 截图选项
 * @returns 截图Blob和URL
 */
async function generateElementScreenshot(
  elementId: string,
  options?: {
    theme?: 'light' | 'dark';
    scale?: number;
  }
): Promise<{ blob: Blob; url: string }> {
  try {
    // 动态导入html2canvas
    const html2canvas = (await import('html2canvas')).default;
    
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`找不到ID为${elementId}的元素`);
    }
    
    // 配置html2canvas选项
    const canvasOptions = {
      backgroundColor: options?.theme === 'dark' ? '#1f1f1f' : '#ffffff',
      scale: options?.scale || 2,
      useCORS: true,
      allowTaint: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc: Document) => {
        optimizeClonedDocument(clonedDoc, elementId);
      }
    };
    
    // 生成canvas
    const canvas = await html2canvas(element, canvasOptions);
    
    // 转换为blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('生成Blob失败'));
        }
      }, 'image/png', 0.95);
    });
    
    const url = URL.createObjectURL(blob);
    return { blob, url };
  } catch (error) {
    errorCollector.captureExportError(
      '鐢熸垚鎴浘澶辫触',
      { 
        error: error as Error,
        details: { stack: (error as Error).stack }
      }
    );
    throw new Error(`生成截图失败: ${(error as Error).message}`);
  }
}

/**
 * 优化克隆的文档，用于截图
 * @param clonedDoc 克隆的文档
 * @param elementId 元素ID
 */
function optimizeClonedDocument(clonedDoc: Document, elementId: string): void {
  const clonedElement = clonedDoc.getElementById(elementId);
  if (!clonedElement) {
    return;
  }
  
  // 移除滚动条和边框
  clonedElement.style.overflow = 'visible';
  clonedElement.style.border = 'none';
  
  // 优化表格样式
  const clonedTable = clonedElement.querySelector('table');
  if (!clonedTable) {
    return;
  }
  
  clonedTable.style.width = 'auto';
  clonedTable.style.tableLayout = 'fixed';
  
  // 优化表头样式
  const headers = clonedTable.querySelectorAll('th');
  headers.forEach((header, index) => {
    const th = header as HTMLElement;
    th.style.textAlign = 'center';
    th.style.verticalAlign = 'middle';
    if (index === headers.length - 1) {
      th.style.borderRight = 'none';
    }
  });
  
  // 优化单元格样式
  const rows = clonedTable.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, cellIndex) => {
      const td = cell as HTMLElement;
      td.style.verticalAlign = 'middle';
      td.style.textAlign = 'center';
      if (cellIndex === cells.length - 1) {
        td.style.borderRight = 'none';
      }
    });
  });
}

/**
 * 获取所有数据表列表
 * @returns 数据表列表
 */
export async function getAllTables(): Promise<ITable[]> {
  try {
    const base = bitable.base;
    const tables = await base.getTableList();
    return Array.isArray(tables) ? tables : [];
  } catch (error) {
    errorCollector.captureApiError(
      '获取所有数据表失败',
      { error: error as Error, severity: ErrorSeverity.MEDIUM }
    );
    return [];
  }
}

/**
 * 获取所有数据表的基本信息（ID和名称）
 * @returns 数据表基本信息列表
 */
export async function getTablesInfo(): Promise<TableInfo[]> {
  try {
    const tables = await getAllTables();
    const tableInfos: TableInfo[] = [];
    
    for (const table of tables) {
      try {
        const tableName = await table.getName();
        tableInfos.push({
          id: table.id,
          name: tableName || `数据表 ${table.id}`
        });
      } catch (error) {
        errorCollector.captureApiError(
          `鑾峰彇鏁版嵁琛?${table.id} 鍚嶇О澶辫触`,      
          { error: error as Error, context: { tableId: table.id }, severity: ErrorSeverity.LOW }
        );
        tableInfos.push({
          id: table.id,
          name: `数据表 ${table.id}`
        });
      }
    }
    
    return tableInfos;
  } catch (error) {
    errorCollector.captureApiError(
      '获取数据表信息失败',
      { error: error as Error, severity: ErrorSeverity.MEDIUM }
    );
    return [];
  }
}

/**
 * 生成表格截图并添加到指定数据表
 * @param elementId 要截图的元素ID
 * @param tableId 数据表ID（可选，默认使用当前活跃表）
 * @returns 添加结果
 */
export async function addTableScreenshotToTable(
  elementId: string,
  tableId?: string,
  options?: {
    theme?: 'light' | 'dark';
    scale?: number;
  }
): Promise<OperationResult<{ recordId: string; imageUrl: string }>> {
  try {
    // 1. 生成截图
    const { blob, url: imageUrl } = await generateElementScreenshot(elementId, options);
    
    // 2. 创建文件对象
    const fileName = `table-export-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    
    // 3. 获取目标数据表
    const table = await getTargetTable(tableId);
    
    // 4. 确保附件字段存在
    const attachmentFieldId = await ensureAttachmentFieldExists(table);
    
    // 5. 添加文件到数据表
    const recordId = await addFileToTable(table, file, attachmentFieldId);
    
    return {
      success: true,
      message: '表格截图已成功添加到数据表',
      recordId,
      imageUrl
    };
  } catch (error) {
    const errorObj = error as Error;
    errorCollector.captureApiError(
      '娣诲姞琛ㄦ牸鎴浘澶辫触',
      { error: errorObj, severity: ErrorSeverity.HIGH }
    );
    return {
      success: false,
      message: errorObj.message
    };
  }
}

/**
 * 将图片添加到指定数据表作为附件
 * @param imageUrl 图片URL
 * @param tableId 数据表ID（可选，默认使用当前活跃表）
 * @returns 添加结果
 */
export async function addImageToTableAttachment(
  imageUrl: string,
  tableId?: string
): Promise<OperationResult<{ recordId: string }>> {
  try {
    // 1. 下载图片为Blob
    const blob = await downloadImageAsBlob(imageUrl);
    
    // 2. 创建文件对象
    const fileName = `table-export-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    
    // 3. 获取目标数据表
    const table = await getTargetTable(tableId);
    
    // 4. 确保附件字段存在
    const attachmentFieldId = await ensureAttachmentFieldExists(table);
    
    // 5. 添加文件到数据表
    const recordId = await addFileToTable(table, file, attachmentFieldId);
    
    return {
      success: true,
      message: '图片已成功添加到数据表',
      recordId
    };
  } catch (error) {
    const errorObj = error as Error;
    errorCollector.captureApiError(
      '娣诲姞鍥剧墖鍒版暟鎹〃澶辫触',
      { error: errorObj, severity: ErrorSeverity.MEDIUM }
    );
    return {
      success: false,
      message: errorObj.message
    };
  }
}

/**
 * 监听数据表选择变化
 * @param callback 变化时的回调函数
 * @returns 取消监听的函数
 */
export function subscribeToTableChanges(callback: () => void): () => void {
  try {
    const base = bitable.base;
    const unsubscribe = base.onSelectionChange(() => {
      callback();
    });
    
    return unsubscribe;
  } catch (error) {
    errorCollector.captureApiError(
      '璁剧疆鏁版嵁琛ㄧ洃鍚け璐?',      
      { error: error as Error, severity: ErrorSeverity.LOW }
    );
    // 返回空函数，避免调用方出错
    return () => {};
  }
}

/**
 * 显示消息提示
 * @param message 消息内容
 * @param type 消息类型
 */
export function showMessage(message: string, type: 'success' | 'error' | 'info'): void {
  const messageEl = document.createElement('div');
  const bgColor = {
    success: '#52c41a',
    error: '#ff4d4f',
    info: '#1890ff'
  }[type];
  
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
    messageEl.remove();
  }, 3000);
}

/**
 * 显示加载状态
 * @param message 加载消息
 * @returns 隐藏加载状态的函数
 */
export function showLoading(message: string = '加载中...'): () => void {
  const loadingEl = document.createElement('div');
  loadingEl.id = 'table-attachment-loading';
  loadingEl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  // 添加加载动画
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #1890ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  `;
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  loadingEl.appendChild(spinner);
  loadingEl.appendChild(document.createTextNode(message));
  document.body.appendChild(loadingEl);
  
  // 返回隐藏加载状态的函数
  return () => {
    loadingEl.remove();
    style.remove();
  };
}
