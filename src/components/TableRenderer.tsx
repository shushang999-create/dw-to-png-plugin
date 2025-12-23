import React, { useState, useEffect, useRef } from 'react';
import { TableRenderData, ExportOptions, ColumnComparisonRule, ComparisonOperator } from '../types';
import { FieldType } from '@lark-base-open/js-sdk';
import { exportRulesToFile, importRulesFromFile } from '../utils/ruleExporter';

interface TableRendererProps {
  data: TableRenderData;
  options: ExportOptions;
  onExport: () => void;
  onAddToTable: () => void; // 添加到表格的回调函数
  onOptionsChange: (options: ExportOptions) => void;
  allFieldTypes: Array<{type: number, name: string}>; // 所有字段类型
  customColumnWidths?: { [fieldId: string]: number }; // 自定义列宽
  onColumnWidthChange?: (fieldId: string, width: number) => void; // 列宽变化回调
  configLoaded: boolean; // 配置是否已加载
  lastSavedTime: string | null; // 最后保存时间
  onClearConfig: () => void; // 清除配置回调
  tables: Array<{ id: string; name: string }>; // 数据表列表
  selectedTableId: string | undefined; // 选中的数据表ID
  setSelectedTableId: (value: string | undefined) => void; // 设置选中的数据表ID
  tablesLoaded: boolean; // 数据表是否加载完成
  isAddingToTable?: boolean; // 是否正在添加到表格
}

const TableRenderer: React.FC<TableRendererProps> = ({
  data,
  options,
  onExport,
  onAddToTable,
  onOptionsChange,
  allFieldTypes,
  customColumnWidths,
  // onColumnWidthChange,
  configLoaded,
  lastSavedTime,
  onClearConfig,
  tables,
  selectedTableId,
  setSelectedTableId,
  tablesLoaded,
  isAddingToTable = false
}) => {
  const [showFieldFilter, setShowFieldFilter] = useState(false);
  const [tempExcludedTypes, setTempExcludedTypes] = useState<number[]>(options.excludedFieldTypes || []);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  
  // 列比较规则状态管理
  const [comparisonRules, setComparisonRules] = useState<ColumnComparisonRule[]>(options.comparisonRules || []);
  const [showComparisonSettings, setShowComparisonSettings] = useState(false);
  const [matchingCells, setMatchingCells] = useState<Set<string>>(new Set());

  // 用于导入文件的隐藏输入元素引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当options中的comparisonRules变化时，更新本地状态
  useEffect(() => {
    if (options.comparisonRules) {
      setComparisonRules(options.comparisonRules);
    }
  }, [options.comparisonRules]);

  // 导出比较规则
  const handleExportRules = () => {
    exportRulesToFile(comparisonRules, 'comparison-rules');
  };

  // 触发文件选择对话框
  const handleImportRulesClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件导入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importRulesFromFile(file, (rules) => {
        if (rules) {
          setComparisonRules(rules);
          onOptionsChange({ ...options, comparisonRules: rules });
        } else {
          alert('导入规则失败，请检查文件格式是否正确');
        }
      });
      // 清空文件输入，以便下次可以选择同一个文件
      event.target.value = '';
    }
  };
  
  // 运算符显示映射
  const operatorDisplay: Record<ComparisonOperator, string> = {
    eq: '等于',
    gt: '大于',
    gte: '大于等于',
    lt: '小于',
    lte: '小于等于'
  };

  // 直接获取表格当前列宽
  const getCurrentTableColumnWidths = (): number[] => {
    if (!tableRef.current) return [];
    
    const table = tableRef.current;
    const headers = table.querySelectorAll('thead th');
    const widths: number[] = [];
    
    headers.forEach((header) => {
      const computedStyle = window.getComputedStyle(header);
      const width = parseFloat(computedStyle.width);
      widths.push(width);
    });
    
    return widths;
  };

  // 使用自定义列宽、视图列宽或计算自适应列宽
  useEffect(() => {
    if (!data || !data.headers.length) return;

    // 优先使用自定义列宽
    if (customColumnWidths) {
      const customWidths = data.headers.map(header => {
        const customWidth = customColumnWidths[header.id];
        return customWidth && customWidth > 0 ? customWidth : undefined;
      });
      
      if (customWidths.every(width => width !== undefined)) {
        setColumnWidths(customWidths as number[]);
        return;
      }
    }

    // 其次使用视图中的列宽信息
    const viewWidths = data.headers.map(header => header.width).filter(width => width !== undefined) as number[];
    
    if (viewWidths.length === data.headers.length && viewWidths.every(width => width > 0)) {
      // 如果所有字段都有视图列宽，直接使用
      setColumnWidths(viewWidths);
    } else {
      // 否则等待DOM渲染完成后获取实际列宽或使用计算宽度
      const timer = setTimeout(() => {
        const actualWidths = getCurrentTableColumnWidths();
        if (actualWidths.length > 0) {
          setColumnWidths(actualWidths);
        } else {
          // 如果无法获取实际宽度，则使用计算宽度作为后备
          calculateFallbackWidths();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [data, customColumnWidths]);

  // 比较两个值是否满足规则
  const compareValues = (value1: string, value2: string, operator: ComparisonOperator): boolean => {
    // 尝试将值转换为数字
    const num1 = parseFloat(value1);
    const num2 = parseFloat(value2);
    
    // 如果都是有效数字，进行数值比较
    if (!isNaN(num1) && !isNaN(num2)) {
      switch (operator) {
        case 'eq': return num1 === num2;
        case 'gt': return num1 > num2;
        case 'gte': return num1 >= num2;
        case 'lt': return num1 < num2;
        case 'lte': return num1 <= num2;
      }
    }
    
    // 否则进行字符串比较
    switch (operator) {
      case 'eq': return value1 === value2;
      case 'gt': return value1 > value2;
      case 'gte': return value1 >= value2;
      case 'lt': return value1 < value2;
      case 'lte': return value1 <= value2;
    }
  };
  
  // 应用所有比较规则，找出匹配的单元格
  const applyComparisonRules = () => {
    const matches = new Set<string>();
    
    if (!comparisonRules || comparisonRules.length === 0) {
      setMatchingCells(matches);
      return;
    }
    
    // 遍历每条规则
    comparisonRules.forEach(rule => {
      // 找到对应的列索引
      const compareColIndex = data.headers.findIndex(h => h.id === rule.compareColumn);
      const targetColIndex = data.headers.findIndex(h => h.id === rule.targetColumn);
      
      if (compareColIndex === -1 || targetColIndex === -1) return;
      
      // 遍历每行数据
      data.rows.forEach((row, rowIndex) => {
        if (rowIndex >= (options.maxRows || data.rows.length)) return;
        
        const compareCell = row.cells[compareColIndex];
        const targetCell = row.cells[targetColIndex];
        
        if (compareCell && targetCell) {
          // 检查是否满足比较条件
          if (compareValues(targetCell.value, compareCell.value, rule.operator)) {
            // 只标记目标列单元格
            matches.add(`${rowIndex}-${targetColIndex}`);
          }
        }
      });
    });
    
    setMatchingCells(matches);
  };
  
  // 当数据或比较规则变化时，重新计算匹配的单元格
  useEffect(() => {
    applyComparisonRules();
  }, [data, comparisonRules, options.maxRows]);
  
  // 添加新的比较规则
  const addComparisonRule = () => {
    const newRule: ColumnComparisonRule = {
      id: `rule-${Date.now()}`,
      compareColumn: data.headers[0]?.id || '',
      targetColumn: data.headers[1]?.id || (data.headers[0]?.id || ''),
      operator: 'eq'
    };
    
    const updatedRules = [...comparisonRules, newRule];
    setComparisonRules(updatedRules);
    onOptionsChange({ ...options, comparisonRules: updatedRules });
  };
  
  // 更新比较规则
  const updateComparisonRule = (id: string, updates: Partial<ColumnComparisonRule>) => {
    const updatedRules = comparisonRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    );
    setComparisonRules(updatedRules);
    onOptionsChange({ ...options, comparisonRules: updatedRules });
  };
  
  // 删除比较规则
  const deleteComparisonRule = (id: string) => {
    const updatedRules = comparisonRules.filter(rule => rule.id !== id);
    setComparisonRules(updatedRules);
    onOptionsChange({ ...options, comparisonRules: updatedRules });
  };
  
  // 后备计算方法（仅在无法获取实际宽度时使用）
  const calculateFallbackWidths = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置字体样式
    const fontSize = options.fontSize || 12;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    const widths: number[] = [];
    
    data.headers.forEach((header, colIndex) => {
      let maxWidth = 100; // 增加最小宽度，确保居中显示效果更好
      const padding = 30; // 增加padding，为居中显示预留更多空间

      // 计算表头宽度（不包括字段类型）
      const headerWidth = ctx.measureText(header.name).width + padding;
      maxWidth = Math.max(maxWidth, headerWidth);

      // 更全面地计算数据行宽度
      // 检查更多行数据以获得更准确的宽度
      const rowsToCheck = Math.min(200, data.rows.length);
      const sampleInterval = Math.max(1, Math.floor(data.rows.length / 50)); // 均匀采样
      
      for (let i = 0; i < rowsToCheck; i += sampleInterval) {
        const cell = data.rows[i].cells[colIndex];
        if (cell && cell.value) {
          // 对于长文本，检查前几个字符和后几个字符
          let textToMeasure = cell.value;
          if (textToMeasure.length > 50) {
            // 对于超长文本，测量开头、中间和结尾部分
            const start = textToMeasure.substring(0, 25);
            const middle = textToMeasure.substring(Math.floor(textToMeasure.length / 2) - 12, Math.floor(textToMeasure.length / 2) + 13);
            const end = textToMeasure.substring(textToMeasure.length - 25);
            textToMeasure = [start, middle, end].sort((a, b) => b.length - a.length)[0];
          }
          
          const cellWidth = ctx.measureText(textToMeasure).width + padding;
          maxWidth = Math.max(maxWidth, cellWidth);
        }
      }

      // 特殊处理某些字段类型
      if (header.type === FieldType.Checkbox) {
        maxWidth = Math.max(maxWidth, 80); // 复选框不需要太大宽度
      } else if (header.type === FieldType.Number || header.type === FieldType.Currency) {
        maxWidth = Math.max(maxWidth, 120); // 数字类型适当增加宽度
      }

      // 根据数据特征调整宽度
      let hasLongContent = false;
      if (data.rows.length > 0) {
        hasLongContent = data.rows.some(row => {
          const cell = row.cells[colIndex];
          return cell && cell.value && cell.value.length > 20;
        });
        
        if (hasLongContent) {
          maxWidth = Math.max(maxWidth, 150); // 有长内容时增加最小宽度
        }
      }

      // 动态调整最大宽度限制
      const dynamicMaxWidth = hasLongContent ? 400 : 300;
      widths.push(Math.min(maxWidth, dynamicMaxWidth));
    });

    setColumnWidths(widths);
  };

  const handleFieldFilterToggle = (fieldType: number) => {
    setTempExcludedTypes(prev => 
      prev.includes(fieldType) 
        ? prev.filter(type => type !== fieldType)
        : [...prev, fieldType]
    );
  };

  const applyFieldFilter = () => {
    onOptionsChange({ ...options, excludedFieldTypes: tempExcludedTypes });
    setShowFieldFilter(false);
  };

  const resetFieldFilter = () => {
    setTempExcludedTypes([]);
    onOptionsChange({ ...options, excludedFieldTypes: [] });
  };

  const getCellAlignment = (): React.CSSProperties => {
    // 所有数据都居中对齐
    return { textAlign: 'center' as const };
  };

  const getCellBackgroundColor = (type: FieldType, value: string): string => {
    if (type === FieldType.Checkbox) {
      return value === '✓' ? '#f0f9ff' : value === '✗' ? '#fef2f2' : 'transparent';
    }
    if (type === FieldType.Progress && value) {
      const progress = parseInt(value.replace('%', ''));
      if (progress >= 80) return '#f0f9ff';
      if (progress >= 50) return '#fef3c7';
      return '#fef2f2';
    }
    return 'transparent';
  };

  return (
    <div style={{ 
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: options.fontSize || 12,
      backgroundColor: options.theme === 'dark' ? '#1f1f1f' : '#ffffff',
      color: options.theme === 'dark' ? '#ffffff' : '#000000'
    }}>
      {/* 导出选项 */}
      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: options.theme === 'dark' ? '#2d2d2d' : '#f5f5f5', borderRadius: '8px' }}>
        {/* 配置状态指示 */}
        {configLoaded && (
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            backgroundColor: options.theme === 'dark' ? '#444' : '#e6f7ff',
            borderRadius: '4px',
            border: `1px solid ${options.theme === 'dark' ? '#555' : '#91d5ff'}`,
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>💡</span>
              <span>已加载历史保存配置</span>
              {lastSavedTime && (
                <span style={{ color: options.theme === 'dark' ? '#999' : '#666', fontSize: '11px' }}>
                  （最后保存：{new Date(lastSavedTime).toLocaleString()}）
                </span>
              )}
            </div>
            <button
              onClick={onClearConfig}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              清除配置
            </button>
          </div>
        )}
        
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>导出选项</h3>
        
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={options.includeHeaders}
              onChange={(e) => onOptionsChange({ ...options, includeHeaders: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            包含表头
          </label>

          {options.includeHeaders && (
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginLeft: '24px' }}>
              <input
                type="checkbox"
                checked={options.includeFieldTypes !== false}
                onChange={(e) => onOptionsChange({ ...options, includeFieldTypes: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              显示字段类型
            </label>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ minWidth: '60px' }}>最大行数:</label>
            <input
              type="number"
              value={options.maxRows || ''}
              placeholder="全部"
              min="1"
              max="1000"
              onChange={(e) => onOptionsChange({ 
                ...options, 
                maxRows: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              style={{ 
                width: '80px', 
                padding: '4px', 
                border: '1px solid #ccc', 
                borderRadius: '4px' 
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px' }}>主题:</label>
          <select
            value={options.theme || 'light'}
            onChange={(e) => onOptionsChange({ ...options, theme: e.target.value as 'light' | 'dark' })}
            style={{ 
              padding: '4px', 
              border: '1px solid #ccc', 
              borderRadius: '4px' 
            }}
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px' }}>字段过滤:</label>
          <button
            onClick={() => setShowFieldFilter(!showFieldFilter)}
            style={{
              padding: '4px 8px',
              backgroundColor: showFieldFilter ? '#1890ff' : '#f0f0f0',
              color: showFieldFilter ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {options.excludedFieldTypes && options.excludedFieldTypes.length > 0 
              ? `已排除 ${options.excludedFieldTypes.length} 种类型` 
              : '设置过滤'}
          </button>
        </div>
        
        {/* 列比较设置 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px' }}>列比较:</label>
          <button
            onClick={() => setShowComparisonSettings(!showComparisonSettings)}
            style={{
              padding: '4px 8px',
              backgroundColor: showComparisonSettings ? '#1890ff' : '#f0f0f0',
              color: showComparisonSettings ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {comparisonRules.length > 0 
              ? `已设置 ${comparisonRules.length} 条规则` 
              : '设置比较'}
          </button>
        </div>
        
        {/* 图片添加到表格设置 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ minWidth: '60px' }}>目标数据表:</label>
          <select
            value={selectedTableId || ''}
            onChange={(e) => setSelectedTableId(e.target.value || undefined)}
            disabled={!tablesLoaded || tables.length === 0}
            style={{ 
              padding: '4px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '150px'
            }}
          >
            {!tablesLoaded ? (
              <option value="">加载中...</option>
            ) : tables.length === 0 ? (
              <option value="">无可用数据表</option>
            ) : (
              tables.map(table => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))
            )}
          </select>
        </div>
        </div>

        {/* 字段过滤器 */}
        {showFieldFilter && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: options.theme === 'dark' ? '#3a3a3a' : '#fafafa',
            borderRadius: '6px',
            border: `1px solid ${options.theme === 'dark' ? '#555' : '#ddd'}`
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px' 
            }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                选择要排除的字段类型
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={resetFieldFilter}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  重置
                </button>
                <button
                  onClick={applyFieldFilter}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  应用
                </button>
              </div>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
              gap: '6px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {allFieldTypes.map(fieldType => (
                <label 
                  key={fieldType.type}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px',
                    borderRadius: '3px',
                    backgroundColor: tempExcludedTypes.includes(fieldType.type) 
                      ? (options.theme === 'dark' ? '#555' : '#e6f7ff')
                      : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tempExcludedTypes.includes(fieldType.type)}
                    onChange={() => handleFieldFilterToggle(fieldType.type)}
                    style={{ marginRight: '6px' }}
                  />
                  {fieldType.name}
                </label>
              ))}
            </div>
          </div>
        )}
        
        {/* 列比较设置 */}
            {showComparisonSettings && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: options.theme === 'dark' ? '#3a3a3a' : '#fafafa',
                borderRadius: '6px',
                border: `1px solid ${options.theme === 'dark' ? '#555' : '#ddd'}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px' 
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                    列比较设置
                  </h4>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* 规则导出/导入按钮 */}
                    <button
                      onClick={handleExportRules}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                      disabled={comparisonRules.length === 0}
                    >
                      导出规则
                    </button>
                    
                    <button
                      onClick={handleImportRulesClick}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#faad14',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      导入规则
                    </button>
                    
                    {/* 隐藏的文件输入元素 */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileImport}
                      accept=".json"
                      style={{ display: 'none' }}
                    />
                    
                    <button
                      onClick={addComparisonRule}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#52c41a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      + 添加规则
                    </button>
                  </div>
                </div>
            
            {/* 操作指引 */}
            <div style={{
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: options.theme === 'dark' ? '#444' : '#fff7e6',
              borderRadius: '4px',
              fontSize: '11px',
              color: options.theme === 'dark' ? '#ccc' : '#fa8c16'
            }}>
              💡 提示：选择比较项列和目标列，设置比较条件，满足条件的目标列单元格将显示为浅红色背景和深红色文本
            </div>
            
            {comparisonRules.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                color: options.theme === 'dark' ? '#999' : '#666',
                fontSize: '12px'
              }}>
                暂无比较规则，点击上方"添加规则"开始设置
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '12px'
              }}>
                {comparisonRules.map((rule, index) => (
                  <div key={rule.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: options.theme === 'dark' ? '#444' : '#f0f0f0',
                    borderRadius: '4px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: options.theme === 'dark' ? '#999' : '#666' }}>
                      规则 {index + 1}:
                    </div>
                    
                    <div style={{ fontSize: '11px', color: options.theme === 'dark' ? '#ccc' : '#666' }}>
                      比较项：
                    </div>
                    
                    {/* 选择比较项列 */}
                    <select
                      value={rule.compareColumn}
                      onChange={(e) => updateComparisonRule(rule.id, { compareColumn: e.target.value })}
                      style={{
                        padding: '4px',
                        border: `1px solid ${options.theme === 'dark' ? '#666' : '#ccc'}`,
                        borderRadius: '3px',
                        backgroundColor: options.theme === 'dark' ? '#333' : '#fff',
                        color: options.theme === 'dark' ? '#fff' : '#000',
                        fontSize: '12px'
                      }}
                    >
                      {data.headers.map(header => (
                        <option key={header.id} value={header.id}>
                          {header.name}
                        </option>
                      ))}
                    </select>
                    
                    {/* 选择运算符 */}
                    <select
                      value={rule.operator}
                      onChange={(e) => updateComparisonRule(rule.id, { operator: e.target.value as ComparisonOperator })}
                      style={{
                        padding: '4px',
                        border: `1px solid ${options.theme === 'dark' ? '#666' : '#ccc'}`,
                        borderRadius: '3px',
                        backgroundColor: options.theme === 'dark' ? '#333' : '#fff',
                        color: options.theme === 'dark' ? '#fff' : '#000',
                        fontSize: '12px'
                      }}
                    >
                      {Object.entries(operatorDisplay).map(([value, display]) => (
                        <option key={value} value={value}>
                          {display}
                        </option>
                      ))}
                    </select>
                    
                    <div style={{ fontSize: '11px', color: options.theme === 'dark' ? '#ccc' : '#666' }}>
                      目标列：
                    </div>
                    
                    {/* 选择目标列 */}
                    <select
                      value={rule.targetColumn}
                      onChange={(e) => updateComparisonRule(rule.id, { targetColumn: e.target.value })}
                      style={{
                        padding: '4px',
                        border: `1px solid ${options.theme === 'dark' ? '#666' : '#ccc'}`,
                        borderRadius: '3px',
                        backgroundColor: options.theme === 'dark' ? '#333' : '#fff',
                        color: options.theme === 'dark' ? '#fff' : '#000',
                        fontSize: '12px'
                      }}
                    >
                      {data.headers.map(header => (
                        <option key={header.id} value={header.id}>
                          {header.name}
                        </option>
                      ))}
                    </select>
                    
                    {/* 删除按钮 */}
                    <button
                      onClick={() => deleteComparisonRule(rule.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ff4d4f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button
            onClick={onExport}
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
            导出为PNG
          </button>
          <button
            onClick={onAddToTable}
            disabled={isAddingToTable}
            style={{
              padding: '8px 16px',
              backgroundColor: '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isAddingToTable ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isAddingToTable ? 0.6 : 1
            }}
          >
            {isAddingToTable ? '添加中...' : '添加到表格'}
          </button>
        </div>
      </div>

      {/* 分组信息显示 */}
      {data.groupInfo && data.groupInfo.length > 0 && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: options.theme === 'dark' ? '#2d2d2d' : '#f0f7ff',
          borderRadius: '6px',
          border: `1px solid ${options.theme === 'dark' ? '#404040' : '#d1e7ff'}`
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 'bold',
            marginBottom: '8px',
            color: options.theme === 'dark' ? '#ffffff' : '#0050b3'
          }}>
            分组字段:
          </div>
          <div style={{ fontSize: '11px', color: options.theme === 'dark' ? '#cccccc' : '#666666' }}>
            {data.groupInfo.map((group) => (
              <span key={group.fieldId} style={{ 
                display: 'inline-block',
                margin: '2px 4px 2px 0',
                padding: '2px 6px',
                backgroundColor: options.theme === 'dark' ? '#404040' : '#e6f7ff',
                border: `1px solid ${options.theme === 'dark' ? '#555555' : '#91d5ff'}`,
                borderRadius: '3px'
              }}>
                {data.headers.find(h => h.id === group.fieldId)?.name || group.fieldId}
                {group.desc && ' (降序)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 表格统计信息 */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: options.theme === 'dark' ? '#cccccc' : '#666666' }}>
        共 {data.rows.length} 条记录，{data.headers.length} 个字段
        {options.maxRows && ` (显示前 ${Math.min(options.maxRows, data.rows.length)} 条)`}
      </div>

      {/* 表格容器 */}
      <div 
        id="table-container"
        style={{ 
          overflow: 'auto',
          border: `1px solid ${options.theme === 'dark' ? '#404040' : '#d9d9d9'}`,
          borderRadius: '8px',
          backgroundColor: options.theme === 'dark' ? '#1f1f1f' : '#ffffff'
        }}
      >
        <table 
          ref={tableRef}
          style={{ 
            borderCollapse: 'separate',
            borderSpacing: '0',
            width: 'auto',
            minWidth: '800px',
            tableLayout: 'fixed'
          }}
        >
          {/* 表头 */}
          {options.includeHeaders && (
            <thead>
              <tr>
                {data.headers.map((header, index) => (
                  <th
                    key={header.id}
                    style={{
                      borderRight: index === data.headers.length - 1 ? 'none' : `1px solid ${options.theme === 'dark' ? '#404040' : '#d9d9d9'}`,
                      borderBottom: `1px solid ${options.theme === 'dark' ? '#404040' : '#d9d9d9'}`,
                      padding: '8px 12px',
                      backgroundColor: options.theme === 'dark' ? '#2d2d2d' : '#fafafa',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '12px',
                      width: columnWidths[index] || (options.cellWidth || 120),
                      minWidth: columnWidths[index] || (options.cellWidth || 120),
                      maxWidth: columnWidths[index] ? `${columnWidths[index] * 1.5}px` : '240px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle'
                    }}
                    title={`${header.name} (${getFieldTypeName(header.type)})`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div>{header.name}</div>
                      {options.includeFieldTypes !== false && (
                        <div style={{ 
                          fontSize: '10px', 
                          fontWeight: 'normal', 
                          color: options.theme === 'dark' ? '#999999' : '#999999',
                          marginTop: '2px'
                        }}>
                          {getFieldTypeName(header.type)}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          {/* 表格数据 */}
          <tbody>
            {data.rows
              .slice(0, options.maxRows || data.rows.length)
              .map((row) => (
                <tr key={row.recordId}>
                  {row.cells.map((cell, cellIndex) => {
                    // 检查当前单元格是否匹配比较规则
                    const isMatchingCell = matchingCells.has(`${data.rows.indexOf(row)}-${cellIndex}`);
                    
                    return (
                      <td
                        key={`${row.recordId}-${cellIndex}`}
                        style={{
                          borderRight: cellIndex === row.cells.length - 1 ? 'none' : `1px solid ${options.theme === 'dark' ? '#404040' : '#d9d9d9'}`,
                          borderBottom: `1px solid ${options.theme === 'dark' ? '#404040' : '#d9d9d9'}`,
                          height: options.cellHeight || 32,
                          width: columnWidths[cellIndex] || (options.cellWidth || 120),
                          minWidth: columnWidths[cellIndex] || (options.cellWidth || 120),
                          maxWidth: columnWidths[cellIndex] ? `${columnWidths[cellIndex] * 1.5}px` : '240px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                          padding: '6px 12px',
                          backgroundColor: isMatchingCell 
                            ? '#ffebee' // 浅红色背景
                            : getCellBackgroundColor(cell.type, cell.value),
                          color: isMatchingCell ? '#c62828' : (options.theme === 'dark' ? '#ffffff' : '#000000'), // 深红色文本
                          fontSize: '12px',
                          fontWeight: isMatchingCell ? 'bold' : 'normal',
                          ...getCellAlignment()
                        }}
                        title={cell.value}
                      >
                        {cell.value}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 辅助函数：获取字段类型名称
function getFieldTypeName(fieldType: FieldType): string {
  const typeNames: Record<number, string> = {
    1: '多行文本',
    2: '数字',
    3: '单选',
    4: '多选',
    5: '日期',
    7: '复选框',
    11: '人员',
    13: '电话',
    15: '超链接',
    17: '附件',
    18: '单向关联',
    21: '双向关联',
    22: '地理位置',
    99003: '货币',
    99002: '进度',
    99004: '评分',
    99005: '邮箱',
    1005: '自动编号',
    20: '公式',
    1001: '创建时间',
    1002: '修改时间',
    1003: '创建人',
    1004: '修改人',
    19: '查找引用',
    99001: '二维码',
    23: '群聊'
  };

  return typeNames[fieldType] || '未知类型';
}

export default TableRenderer;
