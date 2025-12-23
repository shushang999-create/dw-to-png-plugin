import { ColumnComparisonRule } from '../types';

// 规则文件类型定义
export interface ComparisonRuleFile {
  version: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  rules: ColumnComparisonRule[];
  metadata?: {
    [key: string]: any;
  };
}

/**
 * 导出比较规则为JSON文件
 * @param rules 比较规则数组
 * @param name 文件名称
 * @param description 文件描述（可选）
 */
export const exportRulesToFile = (
  rules: ColumnComparisonRule[],
  name: string = 'comparison-rules',
  description?: string
) => {
  try {
    const ruleFile: ComparisonRuleFile = {
      version: '1.0.0',
      name,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rules,
      metadata: {
        ruleCount: rules.length
      }
    };

    const blob = new Blob([JSON.stringify(ruleFile, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('导出规则失败:', error);
    return false;
  }
};

/**
 * 从文件内容解析比较规则
 * @param fileContent 文件内容（JSON字符串）
 * @returns 解析后的比较规则数组或null（如果解析失败）
 */
export const importRulesFromFileContent = (fileContent: string): ColumnComparisonRule[] | null => {
  try {
    const ruleFile = JSON.parse(fileContent) as ComparisonRuleFile;

    // 验证文件格式
    if (!ruleFile.rules || !Array.isArray(ruleFile.rules)) {
      throw new Error('无效的规则文件格式');
    }

    // 验证每个规则的格式
    const validRules = ruleFile.rules.filter(rule => {
      return (
        rule.id &&
        rule.compareColumn &&
        rule.targetColumn &&
        ['eq', 'gt', 'gte', 'lt', 'lte'].includes(rule.operator)
      );
    });

    return validRules;
  } catch (error) {
    console.error('导入规则失败:', error);
    return null;
  }
};

/**
 * 从文件加载比较规则
 * @param file File对象
 * @param callback 回调函数，接收解析后的规则数组
 */
export const importRulesFromFile = (
  file: File,
  callback: (rules: ColumnComparisonRule[] | null) => void
) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    if (e.target && e.target.result) {
      const fileContent = e.target.result as string;
      const rules = importRulesFromFileContent(fileContent);
      callback(rules);
    } else {
      callback(null);
    }
  };
  
  reader.onerror = () => {
    callback(null);
  };
  
  reader.readAsText(file);
};

/**
 * 验证规则文件格式
 * @param fileContent 文件内容
 * @returns 是否为有效的规则文件
 */
export const validateRuleFile = (fileContent: string): boolean => {
  try {
    const ruleFile = JSON.parse(fileContent) as ComparisonRuleFile;
    return (
      typeof ruleFile === 'object' &&
      ruleFile !== null &&
      !!ruleFile.version &&
      !!ruleFile.rules &&
      Array.isArray(ruleFile.rules)
    );
  } catch (error) {
    return false;
  }
};