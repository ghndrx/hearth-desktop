/**
 * SqlFormatterWidget.test.ts
 * Tests for the SQL Formatter Widget - testing the utility functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenize, formatSql, highlightSql, escapeHtml } from '$lib/utils/sqlFormatter';

describe('SqlFormatterWidget', () => {
  beforeEach(() => {
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  describe('tokenize', () => {
    it('tokenizes keywords', () => {
      const tokens = tokenize('SELECT FROM WHERE');
      const keywords = tokens.filter(t => t.type === 'keyword');
      expect(keywords.length).toBe(3);
      expect(keywords.map(t => t.value.toUpperCase())).toEqual(['SELECT', 'FROM', 'WHERE']);
    });

    it('tokenizes identifiers', () => {
      const tokens = tokenize('SELECT user_name FROM users');
      const identifiers = tokens.filter(t => t.type === 'identifier');
      expect(identifiers.map(t => t.value)).toContain('user_name');
      expect(identifiers.map(t => t.value)).toContain('users');
    });

    it('tokenizes strings with single quotes', () => {
      const tokens = tokenize("SELECT * FROM users WHERE name = 'John'");
      const strings = tokens.filter(t => t.type === 'string');
      expect(strings.length).toBe(1);
      expect(strings[0].value).toBe("'John'");
    });

    it('tokenizes strings with escaped quotes', () => {
      const tokens = tokenize("SELECT 'It''s a test'");
      const strings = tokens.filter(t => t.type === 'string');
      expect(strings.length).toBe(1);
      expect(strings[0].value).toBe("'It''s a test'");
    });

    it('tokenizes double-quoted identifiers', () => {
      const tokens = tokenize('SELECT "Column Name" FROM "Table Name"');
      const identifiers = tokens.filter(t => t.type === 'identifier');
      expect(identifiers.map(t => t.value)).toContain('"Column Name"');
      expect(identifiers.map(t => t.value)).toContain('"Table Name"');
    });

    it('tokenizes backtick identifiers (MySQL)', () => {
      const tokens = tokenize('SELECT `column` FROM `table`');
      const identifiers = tokens.filter(t => t.type === 'identifier');
      expect(identifiers.map(t => t.value)).toContain('`column`');
      expect(identifiers.map(t => t.value)).toContain('`table`');
    });

    it('tokenizes square bracket identifiers (SQL Server)', () => {
      const tokens = tokenize('SELECT [Column Name] FROM [dbo].[Table]');
      const identifiers = tokens.filter(t => t.type === 'identifier');
      expect(identifiers.map(t => t.value)).toContain('[Column Name]');
      expect(identifiers.map(t => t.value)).toContain('[dbo]');
    });

    it('tokenizes numbers', () => {
      const tokens = tokenize('SELECT 42, 3.14, 1e10');
      const numbers = tokens.filter(t => t.type === 'number');
      expect(numbers.length).toBe(3);
      expect(numbers[0].value).toBe('42');
      expect(numbers[1].value).toBe('3.14');
    });

    it('tokenizes single-line comments', () => {
      const tokens = tokenize('SELECT * -- this is a comment\nFROM users');
      const comments = tokens.filter(t => t.type === 'comment');
      expect(comments.length).toBe(1);
      expect(comments[0].value).toContain('-- this is a comment');
    });

    it('tokenizes multi-line comments', () => {
      const tokens = tokenize('SELECT /* this is\na comment */ * FROM users');
      const comments = tokens.filter(t => t.type === 'comment');
      expect(comments.length).toBe(1);
      expect(comments[0].value).toContain('/* this is\na comment */');
    });

    it('tokenizes operators', () => {
      const tokens = tokenize('SELECT a = b, c <> d, e >= f, g <= h');
      const operators = tokens.filter(t => t.type === 'operator');
      expect(operators.map(t => t.value)).toContain('=');
      expect(operators.map(t => t.value)).toContain('<>');
      expect(operators.map(t => t.value)).toContain('>=');
      expect(operators.map(t => t.value)).toContain('<=');
    });

    it('tokenizes functions', () => {
      const tokens = tokenize('SELECT COUNT(*), SUM(amount), AVG(price)');
      const functions = tokens.filter(t => t.type === 'function');
      expect(functions.length).toBe(3);
      expect(functions.map(t => t.value.toUpperCase())).toContain('COUNT');
      expect(functions.map(t => t.value.toUpperCase())).toContain('SUM');
      expect(functions.map(t => t.value.toUpperCase())).toContain('AVG');
    });

    it('tokenizes data types', () => {
      const tokens = tokenize('CREATE TABLE t (id INT, name VARCHAR(100), created TIMESTAMP)');
      const dataTypes = tokens.filter(t => t.type === 'datatype');
      expect(dataTypes.map(t => t.value.toUpperCase())).toContain('INT');
      expect(dataTypes.map(t => t.value.toUpperCase())).toContain('VARCHAR');
      expect(dataTypes.map(t => t.value.toUpperCase())).toContain('TIMESTAMP');
    });

    it('tokenizes parentheses', () => {
      const tokens = tokenize('SELECT (a + b)');
      const operators = tokens.filter(t => t.type === 'operator');
      expect(operators.map(t => t.value)).toContain('(');
      expect(operators.map(t => t.value)).toContain(')');
    });

    it('tokenizes semicolons', () => {
      const tokens = tokenize('SELECT 1; SELECT 2;');
      const operators = tokens.filter(t => t.type === 'operator' && t.value === ';');
      expect(operators.length).toBe(2);
    });

    it('handles empty input', () => {
      const tokens = tokenize('');
      expect(tokens.length).toBe(0);
    });

    it('handles whitespace only', () => {
      const tokens = tokenize('   \n\t  ');
      expect(tokens.every(t => t.type === 'whitespace')).toBe(true);
    });
  });

  describe('formatSql', () => {
    const defaultOptions = { indentSize: 2, uppercaseKeywords: true };

    it('formats empty input', () => {
      expect(formatSql('', defaultOptions)).toBe('');
      expect(formatSql('   ', defaultOptions)).toBe('');
    });

    it('uppercases keywords', () => {
      const result = formatSql('select * from users', defaultOptions);
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
    });

    it('lowercases keywords when option is false', () => {
      const result = formatSql('SELECT * FROM users', { indentSize: 2, uppercaseKeywords: false });
      expect(result).toContain('select');
      expect(result).toContain('from');
    });

    it('adds newlines for major clauses', () => {
      const result = formatSql('SELECT id FROM users WHERE active = 1', defaultOptions);
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('formats simple SELECT query', () => {
      const result = formatSql('select id, name from users where active = 1', defaultOptions);
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
      expect(result).toContain('WHERE');
    });

    it('formats JOIN queries', () => {
      const result = formatSql('select u.id from users u left join orders o on u.id = o.user_id', defaultOptions);
      expect(result).toContain('LEFT');
      expect(result).toContain('JOIN');
      expect(result).toContain('ON');
    });

    it('formats GROUP BY and ORDER BY', () => {
      const result = formatSql('select category, count(*) from products group by category order by count(*) desc', defaultOptions);
      expect(result).toContain('GROUP');
      expect(result).toContain('BY');
      expect(result).toContain('ORDER');
      expect(result).toContain('DESC');
    });

    it('formats INSERT statements', () => {
      const result = formatSql("insert into users (name, email) values ('John', 'john@example.com')", defaultOptions);
      expect(result).toContain('INSERT');
      expect(result).toContain('INTO');
      expect(result).toContain('VALUES');
    });

    it('formats UPDATE statements', () => {
      const result = formatSql("update users set name = 'Jane' where id = 1", defaultOptions);
      expect(result).toContain('UPDATE');
      expect(result).toContain('SET');
      expect(result).toContain('WHERE');
    });

    it('formats DELETE statements', () => {
      const result = formatSql('delete from users where id = 1', defaultOptions);
      expect(result).toContain('DELETE');
      expect(result).toContain('FROM');
      expect(result).toContain('WHERE');
    });

    it('formats CREATE TABLE statements', () => {
      const result = formatSql('create table users (id int primary key, name varchar(100))', defaultOptions);
      expect(result).toContain('CREATE');
      expect(result).toContain('TABLE');
      expect(result).toContain('PRIMARY');
      expect(result).toContain('KEY');
    });

    it('preserves string contents', () => {
      const result = formatSql("SELECT * FROM users WHERE name = 'select from where'", defaultOptions);
      expect(result).toContain("'select from where'");
    });

    it('preserves comments', () => {
      const result = formatSql('SELECT * -- get all\nFROM users', defaultOptions);
      expect(result).toContain('-- get all');
    });

    it('handles UNION queries', () => {
      const result = formatSql('SELECT id FROM users UNION SELECT id FROM admins', defaultOptions);
      expect(result).toContain('UNION');
    });

    it('respects indent size option', () => {
      const result2 = formatSql('SELECT id FROM users', { indentSize: 2, uppercaseKeywords: true });
      const result4 = formatSql('SELECT id FROM users', { indentSize: 4, uppercaseKeywords: true });
      // Both should format correctly
      expect(result2).toBeTruthy();
      expect(result4).toBeTruthy();
    });

    it('handles complex nested queries', () => {
      const sql = 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 100)';
      const result = formatSql(sql, defaultOptions);
      expect(result).toContain('IN');
      expect(result).toContain('(');
    });

    it('handles CASE expressions', () => {
      const sql = "SELECT CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END FROM users";
      const result = formatSql(sql, defaultOptions);
      expect(result).toContain('CASE');
      expect(result).toContain('WHEN');
      expect(result).toContain('THEN');
      expect(result).toContain('ELSE');
      expect(result).toContain('END');
    });

    it('handles WITH (CTE) queries', () => {
      const sql = 'WITH active_users AS (SELECT * FROM users WHERE active = 1) SELECT * FROM active_users';
      const result = formatSql(sql, defaultOptions);
      expect(result).toContain('WITH');
      expect(result).toContain('AS');
    });

    it('preserves identifier case', () => {
      const result = formatSql('SELECT MyColumn FROM MyTable', defaultOptions);
      expect(result).toContain('MyColumn');
      expect(result).toContain('MyTable');
    });

    it('handles multiple statements', () => {
      const result = formatSql('SELECT 1; SELECT 2;', defaultOptions);
      expect(result).toContain(';');
      expect(result.split(';').length).toBe(3); // 2 semicolons creates 3 parts
    });

    it('formats functions with uppercase when option is true', () => {
      const result = formatSql('select count(*), sum(amount) from orders', defaultOptions);
      expect(result).toContain('COUNT');
      expect(result).toContain('SUM');
    });

    it('formats data types with uppercase when option is true', () => {
      const result = formatSql('create table t (id int, name varchar(50))', defaultOptions);
      expect(result).toContain('INT');
      expect(result).toContain('VARCHAR');
    });

    it('handles AND/OR clauses', () => {
      const result = formatSql('SELECT * FROM users WHERE a = 1 AND b = 2 OR c = 3', defaultOptions);
      expect(result).toContain('AND');
      expect(result).toContain('OR');
    });

    it('handles HAVING clause', () => {
      const result = formatSql('SELECT category, COUNT(*) FROM products GROUP BY category HAVING COUNT(*) > 5', defaultOptions);
      expect(result).toContain('HAVING');
    });

    it('handles LIMIT and OFFSET', () => {
      const result = formatSql('SELECT * FROM users LIMIT 10 OFFSET 20', defaultOptions);
      expect(result).toContain('LIMIT');
      expect(result).toContain('OFFSET');
    });

    it('handles very long SQL', () => {
      const longSql = 'SELECT ' + Array(100).fill('col').map((c, i) => `${c}${i}`).join(', ') + ' FROM table';
      const result = formatSql(longSql, defaultOptions);
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersands', () => {
      expect(escapeHtml('a & b')).toContain('&amp;');
    });

    it('escapes less than', () => {
      expect(escapeHtml('a < b')).toContain('&lt;');
    });

    it('escapes greater than', () => {
      expect(escapeHtml('a > b')).toContain('&gt;');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('a "b" c')).toContain('&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("a 'b' c")).toContain('&#039;');
    });

    it('converts newlines to br', () => {
      expect(escapeHtml('a\nb')).toContain('<br>');
    });

    it('converts spaces to nbsp', () => {
      expect(escapeHtml('a b')).toContain('&nbsp;');
    });

    it('escapes script tags', () => {
      const result = escapeHtml('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('highlightSql', () => {
    it('returns empty string for empty input', () => {
      expect(highlightSql('')).toBe('');
      expect(highlightSql('   ')).toBe('');
    });

    it('wraps keywords in span with class', () => {
      const result = highlightSql('SELECT');
      expect(result).toContain('class="sql-keyword"');
    });

    it('wraps strings in span with class', () => {
      const result = highlightSql("'hello'");
      expect(result).toContain('class="sql-string"');
    });

    it('wraps numbers in span with class', () => {
      const result = highlightSql('42');
      expect(result).toContain('class="sql-number"');
    });

    it('wraps functions in span with class', () => {
      const result = highlightSql('COUNT(*)');
      expect(result).toContain('class="sql-function"');
    });

    it('wraps comments in span with class', () => {
      const result = highlightSql('-- comment');
      expect(result).toContain('class="sql-comment"');
    });

    it('wraps data types in span with class', () => {
      const result = highlightSql('INT');
      expect(result).toContain('class="sql-datatype"');
    });

    it('wraps identifiers in span with class', () => {
      const result = highlightSql('users');
      expect(result).toContain('class="sql-identifier"');
    });

    it('wraps operators in span with class', () => {
      const result = highlightSql('=');
      expect(result).toContain('class="sql-operator"');
    });

    it('highlights a complete SQL statement', () => {
      const result = highlightSql('SELECT name FROM users WHERE id = 1');
      expect(result).toContain('class="sql-keyword"');
      expect(result).toContain('class="sql-identifier"');
      expect(result).toContain('class="sql-operator"');
      expect(result).toContain('class="sql-number"');
    });

    it('escapes HTML in SQL', () => {
      const result = highlightSql("SELECT '<script>'");
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('integration', () => {
    it('formats and highlights complex SQL correctly', () => {
      const input = `
        select u.id, u.name, count(o.id) as order_count
        from users u
        left join orders o on u.id = o.user_id
        where u.status = 'active' and u.created_at >= '2024-01-01'
        group by u.id, u.name
        having count(o.id) > 0
        order by order_count desc
        limit 10
      `;
      
      const formatted = formatSql(input, { indentSize: 2, uppercaseKeywords: true });
      
      // Check formatting
      expect(formatted).toContain('SELECT');
      expect(formatted).toContain('FROM');
      expect(formatted).toContain('LEFT');
      expect(formatted).toContain('JOIN');
      expect(formatted).toContain('WHERE');
      expect(formatted).toContain('GROUP');
      expect(formatted).toContain('BY');
      expect(formatted).toContain('HAVING');
      expect(formatted).toContain('ORDER');
      expect(formatted).toContain('LIMIT');
      
      // Should have multiple lines
      expect(formatted.split('\n').length).toBeGreaterThan(5);
      
      // Check highlighting
      const highlighted = highlightSql(formatted);
      expect(highlighted).toContain('class="sql-keyword"');
      expect(highlighted).toContain('class="sql-identifier"');
      expect(highlighted).toContain('class="sql-function"');
      expect(highlighted).toContain('class="sql-string"');
    });

    it('handles edge cases without crashing', () => {
      const edgeCases = [
        '',
        '   ',
        'SELECT',
        ';;;',
        '((()))',
        "'''",
        '/**//**/',
        '-- comment\n-- another',
        'SELECT 1e10',
        'SELECT 1.23456789',
      ];
      
      for (const input of edgeCases) {
        expect(() => {
          const formatted = formatSql(input, { indentSize: 2, uppercaseKeywords: true });
          highlightSql(formatted);
        }).not.toThrow();
      }
    });
  });
});
