import React, { useState, useEffect } from 'react';
import { bitable, IFieldMeta, IRecord } from '@lark-base-open/js-sdk';
import TableRenderer from './components/TableRenderer';
import FieldWidthManager from './components/FieldWidthManager';
import { exportToPNG, checkBrowserCompatibility } from './utils/pngExporter';
import { processTableData, getFieldFilterOptions } from './utils/dataProcessor';
import { TableData, TableRenderData, ExportOptions } from './types';
import { loadConfig, saveConfig, clearConfig, getLastSavedTime } from './utils/localStorage';
import { getTablesInfo, showMessage, subscribeToTableChanges, addTableScreenshotToTable } from './utils/imageToTableAttachment';
import errorCollector, { ErrorSeverity } from './utils/errorCollector';

const App: React.FC = () => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [renderData, setRenderData] = useState<TableRenderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 配置相关状态
  const [options, setOptions] = useState<ExportOptions>({
    includeHeaders: true,
    maxRows: undefined,
    cellWidth: 120,
    cellHeight: 32,
    fontSize: 12,
    theme: 'light',
    comparisonRules: [] // 默认空数组
  });
  const [showFieldWidthManager, setShowFieldWidthManager] = useState(false);
  const [fieldWidths, setFieldWidths] = useState<{ [fieldId: string]: number }>({});
  
  // 配置持久化状态
  const [configLoaded, setConfigLoaded] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  // const [currentView, setCurrentView] = useState<any>(null);
  
  // 图片添加到表格相关状态
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>();
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [isAddingToTable, setIsAddingToTable] = useState(false); // 是否正在添加到表格

  // 初始化加载数据
  useEffect(() => {
    loadTableData();
    
    // 监听表格数据变化
    const unsubscribeRecords = bitable.base.onSelectionChange(() => {
      loadTableData();
    });

    return () => {
      unsubscribeRecords();
    };
  }, []);

  // 加载保存的配置
  useEffect(() => {
    const savedConfig = loadConfig();
    const savedLastTime = getLastSavedTime();
    
    if (savedConfig) {
      setOptions(savedConfig.options);
      setFieldWidths(savedConfig.fieldWidths);
      setConfigLoaded(true);
    }
    
    if (savedLastTime) {
      setLastSavedTime(savedLastTime);
    }
  }, []);
  
  // 加载所有数据表列表
  const loadTables = async () => {
    try {
      const tablesList = await getTablesInfo();
      setTables(tablesList);
      
      // 只有在以下情况才设置默认数据表：
      // 1. 首次加载，selectedTableId为空
      // 2. 当前selectedTableId在新的tablesList中不存在
      const isSelectedTableValid = selectedTableId && tablesList.some(table => table.id === selectedTableId);
      if (tablesList.length > 0 && (!selectedTableId || !isSelectedTableValid)) {
        setSelectedTableId(tablesList[0].id);
      }
      
      setTablesLoaded(true);
    } catch (error) {
      errorCollector.captureApiError(
        '鍔犺浇鏁版嵁琛ㄥ垪琛ㄥけ璐?',        { error: error as Error, severity: ErrorSeverity.MEDIUM }
      );
      showMessage('加载数据表列表失败: ' + (error as Error).message, 'error');
    }
  };
  
  useEffect(() => {
    loadTables();
    
    // 监听数据表变化，实现实时更新
    const unsubscribe = subscribeToTableChanges(() => {
      loadTables();
    });
    
    // 返回取消监听的函数
    return () => {
      unsubscribe();
    };
  }, []);

  // 当配置变化时自动保存
  useEffect(() => {
    if (configLoaded || lastSavedTime) {
      const success = saveConfig(options, fieldWidths);
      if (success) {
        setLastSavedTime(new Date().toISOString());
      }
    }
  }, [options, fieldWidths]);

  // 加载表格数据
  const loadTableData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取当前活跃的表格
      const table = await bitable.base.getActiveTable();
      const tableName = await table.getName();
      
      // 获取当前活跃的视图
      const view = await table.getActiveView();
      
      // 获取可见字段的ID列表（按显示顺序）
      const visibleFieldIds = await view.getVisibleFieldIdList();
      
      // 获取所有字段信息
      const allFieldMetaList = await table.getFieldMetaList();
      
      // 根据可见字段ID顺序和可见性过滤字段
      const visibleFields = visibleFieldIds
        .map(fieldId => allFieldMetaList.find(field => field.id === fieldId))
        .filter(field => field !== undefined) as IFieldMeta[];
      
      // 获取可见记录的ID列表（按显示顺序）
      const visibleRecordIds = await view.getVisibleRecordIdList();
      
      // 过滤掉undefined的记录ID
      const validRecordIds = visibleRecordIds.filter((id): id is string => id !== undefined);
      
      // 获取记录数据（限制最多5000条）
      const recordsResponse = await table.getRecords({
        pageSize: 5000
      });
      
      // 根据可见记录顺序重新排序记录
      const orderedRecords = validRecordIds
        .map(recordId => recordsResponse.records.find(record => record.recordId === recordId))
        .filter(record => record !== undefined) as IRecord[];
      
      const data: TableData = {
        fields: visibleFields,
        records: orderedRecords,
        tableName
      };

      setTableData(data);
      
      // 提取视图中的列宽信息和分组信息
      const viewColumnWidths: { [fieldId: string]: number } = {};
      let groupInfo: any[] = [];
      
      try {
        // 使用正确的API获取每个字段的宽度
        for (const field of visibleFields) {
          try {
            const width = await (view as any).getFieldWidth(field.id);
            if (width && width > 0) {
              viewColumnWidths[field.id] = width;
            }
          } catch (fieldErr) {
            console.warn(`无法获取字段 ${field.id} 的宽度:`, fieldErr);
          }
        }
        
        // 获取分组信息
        try {
          groupInfo = await (view as any).getGroupInfo();
        } catch (groupErr) {
          console.warn('无法获取分组信息:', groupErr);
        }
      } catch (err) {
        console.warn('无法获取视图列宽配置:', err);
        // 如果无法获取列宽，使用默认值
      }
      
      // 设置字段宽度状态
      setFieldWidths(viewColumnWidths);
      
      // 处理数据为渲染格式，应用字段过滤
      const processed = processTableData(
        visibleFields, 
        orderedRecords, 
        options.excludedFieldTypes || [],
        viewColumnWidths,
        groupInfo
      );
      setRenderData(processed);
      
      // 自动调整字段宽度（基于实际数据内容）
      setTimeout(() => {
        const autoFitWidths = handleAutoFitWidths(visibleFields, processed);
        setFieldWidths(autoFitWidths);
      }, 100);
      
    } catch (err) {
      errorCollector.captureApiError(
        '鍔犺浇琛ㄦ牸鏁版嵁澶辫触',
        { error: err as Error, severity: ErrorSeverity.HIGH }
      );
      setError(`加载失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理导出
  const handleExport = async () => {
    if (!renderData) {
      setError('没有可导出的数据');
      return;
    }

    // 检查浏览器兼容性
    const compatibility = checkBrowserCompatibility();
    if (!compatibility.compatible) {
      setError(compatibility.message || '浏览器不兼容');
      return;
    }

    try {
      await exportToPNG('table-container', options);
    } catch (err) {
      errorCollector.captureExportError(
        '瀵煎嚭澶辫触',
        { 
          error: err as Error,
          details: { stack: (err as Error).stack }
        }
      );
      setError(`导出失败: ${(err as Error).message}`);
    }
  };
  
  // 处理独立的添加到表格功能
  const handleAddToTable = async () => {
    if (!renderData) {
      setError('没有可添加的数据');
      return;
    }

    try {
      setIsAddingToTable(true);
      
      // 调用添加到表格功能
      const result = await addTableScreenshotToTable(
        'table-container',
        selectedTableId,
        {
          theme: options.theme,
          scale: 2
        }
      );
      
      if (result.success) {
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
    } catch (err) {
      errorCollector.captureApiError(
        '娣诲姞鍒拌〃鏍煎け璐?',        { error: err as Error, severity: ErrorSeverity.MEDIUM }
      );
      showMessage(`添加失败: ${(err as Error).message}`, 'error');
    } finally {
      setIsAddingToTable(false);
    }
  };

  // 处理选项变化
  const handleOptionsChange = (newOptions: ExportOptions) => {
    setOptions(newOptions);
    
    // 如果字段过滤发生变化，重新处理数据
    if ((newOptions.excludedFieldTypes !== options.excludedFieldTypes || newOptions.comparisonRules !== options.comparisonRules) && tableData) {
      const processed = processTableData(
        tableData.fields, 
        tableData.records, 
        newOptions.excludedFieldTypes || [],
        fieldWidths,
        renderData?.groupInfo || [] // 使用之前从视图获取的groupInfo
      );
      setRenderData(processed);
    }
  };

  // 重新加载数据
  const handleReload = () => {
    loadTableData();
  };

  // 处理字段宽度变化
  const handleFieldWidthChange = (fieldId: string, width: number) => {
    setFieldWidths(prev => ({
      ...prev,
      [fieldId]: width
    }));
  };

  // 应用所有字段宽度到预览和输出
  const handleApplyAllWidths = (widths: { [fieldId: string]: number }) => {
    // 只需要更新状态，不需要操作原始视图
    setFieldWidths(widths);
  };

  // 清除保存的配置
  const handleClearConfig = () => {
    const success = clearConfig();
    if (success) {
      // 重置到默认配置
      setOptions({
        includeHeaders: true,
        maxRows: undefined,
        cellWidth: 120,
        cellHeight: 32,
        fontSize: 12,
        theme: 'light'
      });
      setFieldWidths({});
      setConfigLoaded(false);
      setLastSavedTime(null);
    }
  };

  // 自动调整宽度（基于实际数据内容）
  const handleAutoFitWidths = (fields: IFieldMeta[], tableData: TableRenderData): { [fieldId: string]: number } => {
    const autoFitWidths: { [fieldId: string]: number } = {};
    
    fields.forEach(field => {
      let maxContentLength = field.name.length; // 初始为字段名长度（不包括字段类型）
      
      // 如果有表格数据，分析每列的实际内容长度
      if (tableData?.rows) {
        const fieldIndex = tableData.headers.findIndex(h => h.id === field.id);
        if (fieldIndex !== -1) {
          tableData.rows.forEach(row => {
            const cell = row.cells[fieldIndex];
            if (cell && cell.value) {
              const contentLength = cell.value.length;
              if (contentLength > maxContentLength) {
                maxContentLength = contentLength;
              }
            }
          });
        }
      }
      
      // 根据字段类型设置最小宽度，并基于最大内容长度计算
      let minWidth = 30; // 默认最小宽度，降低到30px
      switch (field.type) {
        case 1: // 多行文本
          minWidth = 50;
          break;
        case 15: // 超链接
          minWidth = 60;
          break;
        case 2: // 数字
        case 99003: // 货币
          minWidth = 40;
          break;
        case 99002: // 进度
        case 99004: // 评分
          minWidth = 40;
          break;
        case 5: // 日期
        case 1001: // 创建时间
        case 1002: // 修改时间
          minWidth = 60;
          break;
        case 7: // 复选框
          minWidth = 30;
          break;
        case 11: // 人员
        case 1003: // 创建人
        case 1004: // 修改人
        case 23: // 群聊
          minWidth = 50;
          break;
        case 13: // 电话
          minWidth = 50;
          break;
        case 99005: // 邮箱
          minWidth = 60;
          break;
        case 3: // 单选
        case 4: // 多选
          minWidth = 40;
          break;
        case 17: // 附件
          minWidth = 40;
          break;
        case 18: // 单向关联
        case 21: // 双向关联
        case 19: // 查找引用
          minWidth = 60;
          break;
        case 22: // 地理位置
          minWidth = 60;
          break;
        case 20: // 公式
          minWidth = 50;
          break;
        default:
          minWidth = 40;
      }
      
      // 基于最大内容长度计算宽度（一个汉字6px），但不超过500px
      const calculatedWidth = Math.min(maxContentLength * 6, 500);
      autoFitWidths[field.id] = Math.max(calculatedWidth, minWidth);
    });
    
    return autoFitWidths;
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>正在加载数据...</div>
          <div style={{ fontSize: '12px', color: '#666' }}>请稍候</div>
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '20px',
          border: '1px solid #ff4d4f',
          borderRadius: '8px',
          backgroundColor: '#fff2f0',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '16px', marginBottom: '12px', color: '#ff4d4f' }}>
            加载失败
          </div>
          <div style={{ fontSize: '14px', marginBottom: '16px', color: '#666' }}>
            {error}
          </div>
          <button
            onClick={handleReload}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 渲染空数据状态
  if (!renderData || renderData.rows.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            {tableData?.tableName || '当前表格'} 暂无数据
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
            请先在表格中添加一些记录
          </div>
          <button
            onClick={handleReload}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            刷新数据
          </button>
        </div>
      </div>
    );
  }

  // 渲染主界面
  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #d9d9d9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: 'bold',
            color: '#262626'
          }}>
            {tableData?.tableName || '表格数据导出'}
          </h1>
          <div style={{ 
            fontSize: '12px', 
            color: '#666',
            marginTop: '2px'
          }}>
            将表格数据导出为PNG图片
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowFieldWidthManager(!showFieldWidthManager)}
            style={{
              padding: '6px 12px',
              backgroundColor: showFieldWidthManager ? '#1890ff' : '#f0f0f0',
              color: showFieldWidthManager ? 'white' : '#333',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showFieldWidthManager ? '隐藏宽度管理' : '字段宽度'}
          </button>
          <button
            onClick={handleReload}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            刷新数据
          </button>
        </div>
      </div>

      {/* 表格渲染区域 */}
      <div style={{
        height: 'calc(100vh - 60px)',
        overflow: 'auto'
      }}>
        {/* 字段宽度管理器 */}
        {showFieldWidthManager && tableData && (
          <div style={{ marginBottom: '16px' }}>
            <FieldWidthManager
              fields={tableData.fields}
              currentWidths={fieldWidths}
              onWidthChange={handleFieldWidthChange}
              onApplyAll={handleApplyAllWidths}
              tableData={renderData}
            />
          </div>
        )}

        
        <TableRenderer
          data={renderData}
          options={options}
          onExport={handleExport}
          onAddToTable={handleAddToTable}
          onOptionsChange={handleOptionsChange}
          allFieldTypes={getFieldFilterOptions()}
          customColumnWidths={fieldWidths}
          onColumnWidthChange={handleFieldWidthChange}
          configLoaded={configLoaded}
          lastSavedTime={lastSavedTime}
          onClearConfig={handleClearConfig}
          tables={tables}
          selectedTableId={selectedTableId}
          setSelectedTableId={setSelectedTableId}
          tablesLoaded={tablesLoaded}
          isAddingToTable={isAddingToTable}
        />
      </div>
    </div>
  );
};

export default App;
