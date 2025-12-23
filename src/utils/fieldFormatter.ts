import { FieldType, IOpenCellValue } from '@lark-base-open/js-sdk';
import { FieldFormatConfig } from '../types';

// 格式化数字
export const formatNumber = (value: number, format?: string): string => {
  if (typeof value !== 'number') return String(value);
  
  switch (format) {
    case '0.0':
      return value.toFixed(1);
    case '0.00':
      return value.toFixed(2);
    case '0.000':
      return value.toFixed(3);
    case '0,000':
      return Math.round(value).toLocaleString();
    case '0,000.00':
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case '0%':
      return (value * 100).toFixed(0) + '%';
    case '0.00%':
      return (value * 100).toFixed(2) + '%';
    default:
      return String(value);
  }
};

// 格式化日期
export const formatDate = (value: number, format?: string): string => {
  if (typeof value !== 'number') return String(value);
  
  const date = new Date(value);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  switch (format) {
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`;
    case 'yyyy/MM/dd':
      return `${year}/${month}/${day}`;
    case 'MM-dd':
      return `${month}-${day}`;
    case 'MM/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`;
    case 'yyyy-MM-dd HH:mm':
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case 'yyyy/MM/dd HH:mm':
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    default:
      return `${year}-${month}-${day}`;
  }
};

// 格式化复选框值
export const formatCheckbox = (value: boolean): string => {
  return value ? '☑' : '☐';
};

// 格式化单选值
export const formatSingleSelect = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'object' && 'text' in value && value.text) return (value as any).text;
  return String(value);
};

// 格式化多选值
export const formatMultiSelect = (value: any[]): string => {
  if (!Array.isArray(value)) return '';
  return value.map(item => {
    if (typeof item === 'object' && item.text) return item.text;
    return String(item);
  }).join(', ');
};

// 格式化用户值
export const formatUser = (value: any): string => {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map(user => {
      if (typeof user === 'object' && user.name) return user.name;
      return String(user);
    }).join(', ');
  }
  if (typeof value === 'object' && value.name) return value.name;
  return String(value);
};

// 格式化附件值
export const formatAttachment = (value: any[]): string => {
  if (!Array.isArray(value)) return '';
  return value.map(attachment => {
    if (typeof attachment === 'object' && attachment.name) return attachment.name;
    return String(attachment);
  }).join(', ');
};

// 格式化链接值
export const formatLink = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'object' && value.text) return value.text;
  return String(value);
};

// 格式化地理位置值
export const formatLocation = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'object' && value.address) return value.address;
  return String(value);
};

// 主要格式化函数
export const formatCellValue = (
  value: IOpenCellValue,
  fieldType: FieldType,
  format?: FieldFormatConfig
): string => {
  // 如果值为空，返回空字符串
  if (value === null || value === undefined) return '';
  
  // 根据字段类型进行格式化
  switch (fieldType) {
    case FieldType.Text:
      if (Array.isArray(value)) {
        return value.map(segment => {
          if (typeof segment === 'object' && 'text' in segment && segment.text) return segment.text;
          return String(segment);
        }).join('');
      }
      return String(value);
      
    case FieldType.Number:
      // 优先使用字段配置中的格式化器
      const formatter = format?.numberFormat || '0.00';
      return formatNumber(value as number, formatter);
      
    case FieldType.DateTime:
    case FieldType.CreatedTime:
    case FieldType.ModifiedTime:
      return formatDate(value as number, format?.dateFormat);
      
    case FieldType.Checkbox:
      return formatCheckbox(value as boolean);
      
    case FieldType.SingleSelect:
      return formatSingleSelect(value);
      
    case FieldType.MultiSelect:
      return formatMultiSelect(value as any[]);
      
    case FieldType.User:
    case FieldType.CreatedUser:
    case FieldType.ModifiedUser:
      return formatUser(value);
      
    case FieldType.Attachment:
      return formatAttachment(value as any[]);
      
    case FieldType.SingleLink:
    case FieldType.DuplexLink:
    case FieldType.Lookup:
      return formatLink(value);
      
    case FieldType.Location:
      return formatLocation(value);
      
    case FieldType.Phone:
      return String(value);
    
    case FieldType.Url:
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'object' && 'link' in item) {
            return (item as any).link;
          }
          return String(item);
        }).join(', ');
      }
      return String(value);
    
    case FieldType.Email:
      return String(value);
    
    case FieldType.Barcode:
      return String(value);
    
    case FieldType.AutoNumber:
      if (typeof value === 'object' && value !== null) {
        return (value as any).value || '';
      }
      return String(value);
    
    case FieldType.Progress:
      // 进度字段，格式化为百分比
      return typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value);
    
    case FieldType.Currency:
      // 货币字段，使用指定的格式化器
      const currencyFormatter = format?.numberFormat || '0.00';
      return formatNumber(value as number, currencyFormatter);
    
    case FieldType.Rating:
      // 评分字段，显示为星星
      return typeof value === 'number' ? '★'.repeat(value) : String(value);
    
    case FieldType.GroupChat:
      return String(value);
    
    case FieldType.Formula:
      // 公式字段根据其实际值类型进行格式化
      if (typeof value === 'number') {
        const formulaFormatter = format?.numberFormat || '0.00';
        return formatNumber(value, formulaFormatter);
      } else if (typeof value === 'boolean') {
        return formatCheckbox(value);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object' && 'text' in value[0]) {
          // 公式返回多选值
          return formatMultiSelect(value);
        }
        // 公式返回数组
        return value.map(v => String(v)).join(', ');
      }
      return String(value);
      
    default:
      return String(value);
  }
};

// 获取字段的显示名称（包括字段类型）
export const getFieldDisplayName = (
  fieldName: string,
  fieldType: FieldType,
  showType: boolean = false
): string => {
  if (!showType) return fieldName;
  
  const typeNames: { [key: number]: string } = {
    [FieldType.Text]: '多行文本',
    [FieldType.Number]: '数字',
    [FieldType.SingleSelect]: '单选',
    [FieldType.MultiSelect]: '多选',
    [FieldType.DateTime]: '日期',
    [FieldType.Checkbox]: '复选框',
    [FieldType.User]: '人员',
    [FieldType.Phone]: '电话',
    [FieldType.Url]: '超链接',
    [FieldType.Attachment]: '附件',
    [FieldType.SingleLink]: '单向关联',
    [FieldType.Lookup]: '查找引用',
    [FieldType.Formula]: '公式',
    [FieldType.DuplexLink]: '双向关联',
    [FieldType.Location]: '地理位置',
    [FieldType.GroupChat]: '群聊',
    [FieldType.CreatedTime]: '创建时间',
    [FieldType.ModifiedTime]: '修改时间',
    [FieldType.CreatedUser]: '创建人',
    [FieldType.ModifiedUser]: '修改人',
    [FieldType.AutoNumber]: '自动编号',
    [FieldType.Barcode]: '二维码',
    [FieldType.Progress]: '进度',
    [FieldType.Currency]: '货币',
    [FieldType.Rating]: '评分',
    [FieldType.Email]: '邮箱'
  };
  
  const typeName = typeNames[fieldType] || '未知类型';
  return `${fieldName} (${typeName})`;
};

// 应用字段格式样式
export const applyFieldFormat = (
  element: HTMLElement,
  format: FieldFormatConfig
): void => {
  if (format.fontSize) {
    element.style.fontSize = `${format.fontSize}px`;
  }
  if (format.fontWeight) {
    element.style.fontWeight = format.fontWeight;
  }
  if (format.color) {
    element.style.color = format.color;
  }
  if (format.backgroundColor) {
    element.style.backgroundColor = format.backgroundColor;
  }
  if (format.textAlign) {
    element.style.textAlign = format.textAlign;
  }
  if (format.padding) {
    element.style.padding = `${format.padding}px`;
  }
  
  if (format.border) {
    element.style.border = `1px solid ${format.borderColor || '#d9d9d9'}`;
  } else {
    element.style.border = 'none';
  }
};

// 获取字段类型的默认格式
export const getDefaultFieldFormat = (fieldType: FieldType): Partial<FieldFormatConfig> => {
  const baseFormat = {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: '#000000',
    backgroundColor: '#ffffff',
    textAlign: 'left' as const,
    padding: 8,
    border: true,
    borderColor: '#d9d9d9',
    showFieldType: false
  };
  
  switch (fieldType) {
    case FieldType.Number:
    case FieldType.Currency:
    case FieldType.Progress:
    case FieldType.Rating:
      return {
        ...baseFormat,
        textAlign: 'right',
        numberFormat: '0.00' // 默认设置为两位小数格式
      };
      
    case FieldType.DateTime:
    case FieldType.CreatedTime:
    case FieldType.ModifiedTime:
      return {
        ...baseFormat,
        textAlign: 'center',
        dateFormat: 'yyyy-MM-dd'
      };
      
    case FieldType.Checkbox:
      return {
        ...baseFormat,
        textAlign: 'center'
      };
      
    default:
      return baseFormat;
  }
};

/**
 * 检查字段名是否需要特殊格式化（保留两位小数）
 */
export const needsTwoDecimalFormat = (fieldName: string): boolean => {
  const specialFields = ['成材率', '非定尺率', '负公差'];
  return specialFields.some(field => fieldName.includes(field));
};

/**
 * 格式化数字为两位小数
 */
export const formatToTwoDecimals = (value: any): string => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  // 如果是字符串，尝试转换为数字
  const numValue = parseFloat(String(value));
  if (!isNaN(numValue)) {
    return numValue.toFixed(2);
  }
  // 如果不是数字，返回原值
  return String(value);
};
