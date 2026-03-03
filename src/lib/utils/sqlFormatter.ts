/**
 * SQL Formatter Utility
 * Provides tokenization, formatting, and syntax highlighting for SQL queries
 */

// SQL keywords for formatting and highlighting
// Note: Functions like COUNT, SUM, AVG are in the functions list, not here
export const keywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'DROP', 'ALTER', 'ADD',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
  'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
  'NULL', 'IS', 'LIKE', 'BETWEEN', 'ASC', 'DESC', 'WITH', 'RECURSIVE',
  'OVER', 'PARTITION', 'FIRST', 'LAST',
  'IF', 'ELSEIF', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'TRUNCATE',
  'TRUE', 'FALSE', 'DEFAULT', 'AUTO_INCREMENT', 'SERIAL', 'CASCADE', 'RESTRICT',
  'RETURNING', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'PERCENT', 'TOP', 'LATERAL'
];

// Data types for highlighting
export const dataTypes = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE',
  'VARCHAR', 'CHAR', 'TEXT', 'NVARCHAR', 'NCHAR', 'NTEXT', 'CLOB', 'BLOB',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'YEAR', 'MONTH',
  'BOOLEAN', 'BOOL', 'BIT', 'BINARY', 'VARBINARY', 'UUID', 'JSON', 'JSONB', 'XML', 'ARRAY'
];

// Functions for highlighting
export const functions = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
  'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'SUBSTRING', 'SUBSTR', 'CONCAT', 'LENGTH', 'LEN',
  'ROUND', 'FLOOR', 'CEILING', 'ABS', 'MOD', 'POWER', 'SQRT',
  'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'GETDATE', 'DATEADD', 'DATEDIFF',
  'EXTRACT', 'DATE_PART', 'DATE_TRUNC', 'TO_DATE', 'TO_CHAR', 'TO_NUMBER',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
  'STRING_AGG', 'ARRAY_AGG', 'JSON_AGG', 'GROUP_CONCAT', 'LISTAGG'
];

// Keywords that start new lines
const lineBreakKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
  'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'WITH', 'RETURNING', 'FETCH', 'ON'
];

// Keywords that increase indentation
const indentIncreaseKeywords = ['SELECT', 'SET', 'VALUES'];
// Keywords that decrease indentation
const indentDecreaseKeywords = ['FROM', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'UNION', 'INTERSECT', 'EXCEPT'];

export interface Token {
  type: 'keyword' | 'datatype' | 'function' | 'identifier' | 'string' | 'number' | 'comment' | 'operator' | 'whitespace' | 'other';
  value: string;
}

export interface FormatOptions {
  indentSize: number;
  uppercaseKeywords: boolean;
}

/**
 * Tokenize SQL into meaningful parts
 */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < sql.length) {
    // Skip whitespace but track it
    if (/\s/.test(sql[i])) {
      let ws = '';
      while (i < sql.length && /\s/.test(sql[i])) {
        ws += sql[i++];
      }
      tokens.push({ type: 'whitespace', value: ws });
      continue;
    }
    
    // Single-line comments
    if (sql.slice(i, i + 2) === '--') {
      let comment = '';
      while (i < sql.length && sql[i] !== '\n') {
        comment += sql[i++];
      }
      tokens.push({ type: 'comment', value: comment });
      continue;
    }
    
    // Multi-line comments
    if (sql.slice(i, i + 2) === '/*') {
      let comment = '';
      while (i < sql.length && sql.slice(i, i + 2) !== '*/') {
        comment += sql[i++];
      }
      if (i < sql.length) {
        comment += sql[i++] + sql[i++]; // Add */
      }
      tokens.push({ type: 'comment', value: comment });
      continue;
    }
    
    // Strings (single quotes)
    if (sql[i] === "'") {
      let str = sql[i++];
      while (i < sql.length && (sql[i] !== "'" || sql[i + 1] === "'")) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          str += sql[i++] + sql[i++];
        } else {
          str += sql[i++];
        }
      }
      if (i < sql.length) str += sql[i++];
      tokens.push({ type: 'string', value: str });
      continue;
    }
    
    // Strings (double quotes - identifiers in some DBs)
    if (sql[i] === '"') {
      let str = sql[i++];
      while (i < sql.length && sql[i] !== '"') {
        str += sql[i++];
      }
      if (i < sql.length) str += sql[i++];
      tokens.push({ type: 'identifier', value: str });
      continue;
    }
    
    // Backtick identifiers (MySQL)
    if (sql[i] === '`') {
      let str = sql[i++];
      while (i < sql.length && sql[i] !== '`') {
        str += sql[i++];
      }
      if (i < sql.length) str += sql[i++];
      tokens.push({ type: 'identifier', value: str });
      continue;
    }
    
    // Square bracket identifiers (SQL Server)
    if (sql[i] === '[') {
      let str = sql[i++];
      while (i < sql.length && sql[i] !== ']') {
        str += sql[i++];
      }
      if (i < sql.length) str += sql[i++];
      tokens.push({ type: 'identifier', value: str });
      continue;
    }
    
    // Numbers
    if (/\d/.test(sql[i]) || (sql[i] === '.' && /\d/.test(sql[i + 1] || ''))) {
      let num = '';
      while (i < sql.length && /[\d.eE+-]/.test(sql[i])) {
        num += sql[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    
    // Operators and punctuation
    if (/[(),;=<>!+\-*/%&|^~:]/.test(sql[i])) {
      let op = sql[i++];
      // Handle multi-char operators
      if (op === '<' && sql[i] === '=') op += sql[i++];
      else if (op === '>' && sql[i] === '=') op += sql[i++];
      else if (op === '<' && sql[i] === '>') op += sql[i++];
      else if (op === '!' && sql[i] === '=') op += sql[i++];
      else if (op === '|' && sql[i] === '|') op += sql[i++];
      else if (op === ':' && sql[i] === ':') op += sql[i++];
      tokens.push({ type: 'operator', value: op });
      continue;
    }
    
    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(sql[i])) {
      let word = '';
      while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) {
        word += sql[i++];
      }
      const upperWord = word.toUpperCase();
      // Check functions first (more specific), then data types, then keywords
      if (functions.includes(upperWord)) {
        tokens.push({ type: 'function', value: word });
      } else if (dataTypes.includes(upperWord)) {
        tokens.push({ type: 'datatype', value: word });
      } else if (keywords.includes(upperWord)) {
        tokens.push({ type: 'keyword', value: word });
      } else {
        tokens.push({ type: 'identifier', value: word });
      }
      continue;
    }
    
    // Any other character
    tokens.push({ type: 'other', value: sql[i++] });
  }
  
  return tokens;
}

/**
 * Format SQL with proper indentation and keyword capitalization
 */
export function formatSql(sql: string, options: FormatOptions): string {
  if (!sql.trim()) return '';
  
  const tokens = tokenize(sql);
  let result = '';
  let indentLevel = 0;
  const indent = () => ' '.repeat(options.indentSize * indentLevel);
  let parenDepth = 0;
  let prevNonWsToken: Token | null = null;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Skip original whitespace - we'll add our own
    if (token.type === 'whitespace') {
      continue;
    }
    
    // Handle keywords
    if (token.type === 'keyword') {
      const upperValue = token.value.toUpperCase();
      const formattedKeyword = options.uppercaseKeywords ? upperValue : token.value.toLowerCase();
      
      // Check if this keyword starts a new line
      if (lineBreakKeywords.includes(upperValue) && parenDepth === 0) {
        // Adjust indentation
        if (indentDecreaseKeywords.includes(upperValue)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }
        
        if (result && !result.endsWith('\n')) {
          result += '\n' + indent();
        } else if (!result) {
          // First token, no newline needed
        } else {
          result += indent();
        }
        
        result += formattedKeyword;
        
        // Increase indent after certain keywords
        if (indentIncreaseKeywords.includes(upperValue)) {
          indentLevel++;
        }
      } else {
        // Inline keyword
        if (result && !result.endsWith(' ') && !result.endsWith('\n') && !result.endsWith('(')) {
          result += ' ';
        }
        result += formattedKeyword;
      }
      
      prevNonWsToken = token;
      continue;
    }
    
    // Handle parentheses
    if (token.type === 'operator') {
      if (token.value === '(') {
        parenDepth++;
        if (result && !result.endsWith(' ') && !result.endsWith('\n') && !result.endsWith('(')) {
          // Check if previous token was a function - no space before (
          if (prevNonWsToken?.type !== 'function' && prevNonWsToken?.type !== 'identifier') {
            result += ' ';
          }
        }
        result += token.value;
      } else if (token.value === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        result += token.value;
      } else if (token.value === ',') {
        result += token.value;
        if (parenDepth === 0 && (prevNonWsToken?.type === 'identifier' || prevNonWsToken?.type === 'keyword')) {
          result += '\n' + indent() + '       '; // Align with SELECT columns
        }
      } else if (token.value === ';') {
        result += token.value + '\n';
        indentLevel = 0;
      } else {
        // Other operators (=, <, >, etc.)
        if (!result.endsWith(' ') && !result.endsWith('\n') && !result.endsWith('(')) {
          result += ' ';
        }
        result += token.value;
      }
      prevNonWsToken = token;
      continue;
    }
    
    // Handle comments
    if (token.type === 'comment') {
      if (!result.endsWith(' ') && !result.endsWith('\n')) {
        result += ' ';
      }
      result += token.value;
      if (!token.value.includes('\n') && !token.value.startsWith('/*')) {
        result += '\n' + indent();
      }
      prevNonWsToken = token;
      continue;
    }
    
    // Handle everything else (strings, numbers, identifiers, etc.)
    if (result && !result.endsWith(' ') && !result.endsWith('\n') && !result.endsWith('(')) {
      result += ' ';
    }
    
    // Format functions and data types
    if (token.type === 'function' || token.type === 'datatype') {
      result += options.uppercaseKeywords ? token.value.toUpperCase() : token.value.toLowerCase();
    } else {
      result += token.value;
    }
    
    prevNonWsToken = token;
  }
  
  return result.trim();
}

/**
 * Escape HTML characters for safe rendering
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
    .replace(/ /g, '&nbsp;');
}

/**
 * Generate HTML with syntax highlighting
 */
export function highlightSql(sql: string): string {
  if (!sql.trim()) return '';
  
  const tokens = tokenize(sql);
  let html = '';
  
  for (const token of tokens) {
    const escaped = escapeHtml(token.value);
    
    switch (token.type) {
      case 'keyword':
        html += `<span class="sql-keyword">${escaped}</span>`;
        break;
      case 'datatype':
        html += `<span class="sql-datatype">${escaped}</span>`;
        break;
      case 'function':
        html += `<span class="sql-function">${escaped}</span>`;
        break;
      case 'string':
        html += `<span class="sql-string">${escaped}</span>`;
        break;
      case 'number':
        html += `<span class="sql-number">${escaped}</span>`;
        break;
      case 'comment':
        html += `<span class="sql-comment">${escaped}</span>`;
        break;
      case 'operator':
        html += `<span class="sql-operator">${escaped}</span>`;
        break;
      case 'identifier':
        html += `<span class="sql-identifier">${escaped}</span>`;
        break;
      default:
        html += escaped;
    }
  }
  
  return html;
}
