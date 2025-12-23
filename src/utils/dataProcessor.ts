import { 
  FieldType, 
  IFieldMeta, 
  IRecord, 
  IOpenCellValue,
  IOpenUser,
  IOpenAttachment,
  IOpenSingleSelect,
  IOpenMultiSelect,
  IOpenLocation,
  IOpenLink
} from '@lark-base-open/js-sdk';
import { ProcessedCellData, TableRenderData, FieldFormatConfig } from '../types';
import { needsTwoDecimalFormat, formatToTwoDecimals, formatCellValue } from './fieldFormatter';



/**
 * 处理不同类型的字段值，转换为可显示的字符串
 */
export function processCellValue(value: IOpenCellValue, fieldType: FieldType, formatter?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (fieldType) {
    case FieldType.Text:
      if (Array.isArray(value)) {
        return (value as any[]).map(item => item.text || '').join('');
      }
      return String(value);

    case FieldType.Number:
      // 确保数字精度完全保持
      if (typeof value === 'number') {
        let result: string;
        
        // 使用 toLocaleString 确保本地化格式，但去除千分位分隔符
        const localizedStr = value.toLocaleString('zh-CN', { 
          useGrouping: false,
          minimumFractionDigits: 0,
          maximumFractionDigits: 20
        });
        
        // 如果提供了formatter，则使用formatter格式化
        if (formatter && typeof value === 'number') {
          const decimalPlaces = parseInt(formatter.split('.')[1] || '0');
          result = value.toFixed(decimalPlaces);
        } else {
          result = localizedStr;
        }
        
        return result;
      }
      return String(value);

    case FieldType.SingleSelect:
      const singleSelect = value as IOpenSingleSelect;
      return singleSelect?.text || '';

    case FieldType.MultiSelect:
      const multiSelect = value as IOpenMultiSelect;
      return multiSelect?.map(item => item.text).join(', ') || '';

    case FieldType.DateTime:
      return String(value);

    case FieldType.Checkbox:
      return value ? '✓' : '✗';

    case FieldType.User:
      const users = value as IOpenUser[];
      return users?.map(user => user.name || user.enName || '').join(', ') || '';

    case FieldType.Phone:
      return String(value);

    case FieldType.Url:
      if (Array.isArray(value)) {
        return (value as any[]).map(item => item.link || item.text || '').join(', ');
      }
      return String(value);

    case FieldType.Attachment:
      const attachments = value as IOpenAttachment[];
      return attachments?.map(att => att.name).join(', ') || '';

    case FieldType.SingleLink:
    case FieldType.DuplexLink:
      const link = value as IOpenLink;
      return link?.text || '';

    case FieldType.Location:
      const location = value as IOpenLocation;
      return location?.fullAddress || location?.address || '';

    case FieldType.Currency:
      return typeof value === 'number' ? String(value) : String(value);

    case FieldType.Progress:
      return typeof value === 'number' ? String(value) : String(value);

    case FieldType.Rating:
      return typeof value === 'number' ? '★'.repeat(value) : String(value);

    case FieldType.Email:
      return String(value);

    case FieldType.AutoNumber:
      if (typeof value === 'object' && value !== null) {
        return (value as any).value || '';
      }
      return String(value);

    case FieldType.Formula:
      // 公式字段可能是多种类型
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return (item as any).text || '';
          }
          return String(item);
        }).join('');
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * 处理表格数据，转换为渲染所需的格式
 */
export function processTableData(
  fields: IFieldMeta[], 
  records: IRecord[],
  excludedFieldTypes: number[] = [],
  viewColumnWidths?: { [fieldId: string]: number },
  groupInfo?: Array<{ fieldId: string; desc: boolean }>
): TableRenderData {
  // 过滤掉排除的字段类型
  const filteredFields = fields.filter(field => !excludedFieldTypes.includes(field.type));
  
  const headers = filteredFields.map(field => ({
    id: field.id,
    name: field.name,
    type: field.type,
    width: viewColumnWidths?.[field.id], // 使用视图中的列宽
    property: field.property // 保存字段属性，包含格式化配置
  }));

  const rows = records.map(record => {
    const cells = headers.map(header => {
      const cellValue = record.fields[header.id];      
      // 从字段元数据获取完整的字段配置
      const field = filteredFields.find(f => f.id === header.id);
      if (!field) {
        return {
          value: String(cellValue || ''),
          type: header.type,
          originalValue: cellValue,
          fieldMeta: field
        } as ProcessedCellData;
      }
      
      // 构建字段格式化配置
      const formatConfig: FieldFormatConfig = {
        // 基本样式配置
        fontSize: 12,
        fontWeight: 'normal',
        color: '#000000',
        backgroundColor: '#ffffff',
        textAlign: 'left',
        padding: 8,
        border: true,
        borderColor: '#d9d9d9'
      };
      
      // 根据字段类型安全地添加特定格式化配置
      switch (header.type) {
        case FieldType.Number:
        case FieldType.Currency:
        case FieldType.Progress:
          // 数字类型字段的格式化器
          formatConfig.numberFormat = (field.property as any)?.formatter || '0.00';
          break;
        case FieldType.DateTime:
        case FieldType.CreatedTime:
        case FieldType.ModifiedTime:
          // 日期类型字段的格式化器
          formatConfig.dateFormat = (field.property as any)?.date_format || 'yyyy-MM-dd';
          break;
      }
      
      // 使用formatCellValue函数处理单元格值，同时考虑原始值和列元数据
      let processedValue = formatCellValue(cellValue, header.type, formatConfig);
      
      // 检查字段名是否需要特殊格式化（保留两位小数）
      // 只对数字类型字段应用此规则
      if ([FieldType.Number, FieldType.Currency, FieldType.Progress].includes(header.type) && 
          !((field.property as any)?.formatter) && 
          needsTwoDecimalFormat(header.name)) {
        processedValue = formatToTwoDecimals(cellValue);
      }
      
      return {
        value: processedValue,
        type: header.type,
        originalValue: cellValue,
        fieldMeta: field // 保存字段元数据，用于后续渲染
      } as ProcessedCellData;
    });

    return {
      recordId: record.recordId,
      cells
    };
  });

  return {
    headers,
    rows,
    groupInfo
  };
}

/**
 * 获取所有字段类型的过滤选项
 */
export function getFieldFilterOptions(): Array<{type: number, name: string}> {
  return [
    { type: 1, name: '多行文本' },
    { type: 2, name: '数字' },
    { type: 3, name: '单选' },
    { type: 4, name: '多选' },
    { type: 5, name: '日期' },
    { type: 7, name: '复选框' },
    { type: 11, name: '人员' },
    { type: 13, name: '电话' },
    { type: 15, name: '超链接' },
    { type: 17, name: '附件' },
    { type: 18, name: '单向关联' },
    { type: 21, name: '双向关联' },
    { type: 22, name: '地理位置' },
    { type: 99003, name: '货币' },
    { type: 99002, name: '进度' },
    { type: 99004, name: '评分' },
    { type: 99005, name: '邮箱' },
    { type: 1005, name: '自动编号' },
    { type: 20, name: '公式' },
    { type: 1001, name: '创建时间' },
    { type: 1002, name: '修改时间' },
    { type: 1003, name: '创建人' },
    { type: 1004, name: '修改人' },
    { type: 19, name: '查找引用' },
    { type: 99001, name: '二维码' },
    { type: 23, name: '群聊' }
  ];
}

/**
 * 获取字段类型的显示名称
 */
export function getFieldTypeName(fieldType: FieldType): string {
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
