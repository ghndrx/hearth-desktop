//! Markdown Preview - converts Markdown text to sanitized HTML
//!
//! Supports headings, bold, italic, code blocks, inline code, links, images,
//! unordered/ordered lists, blockquotes, horizontal rules, and strikethrough.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownResult {
    pub html: String,
    pub word_count: usize,
    pub line_count: usize,
    pub char_count: usize,
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn process_inline(line: &str) -> String {
    let escaped = escape_html(line);
    let mut result = escaped;

    // Inline code (must be first to avoid processing markup inside code)
    let mut out = String::new();
    let mut chars = result.chars().peekable();
    let mut in_code = false;
    let mut buf = String::new();
    while let Some(c) = chars.next() {
        if c == '`' && !in_code {
            out.push_str(&process_inline_formatting(&buf));
            buf.clear();
            in_code = true;
            out.push_str("<code>");
        } else if c == '`' && in_code {
            out.push_str(&buf);
            buf.clear();
            in_code = false;
            out.push_str("</code>");
        } else {
            buf.push(c);
        }
    }
    if in_code {
        out.push('`');
        out.push_str(&buf);
    } else {
        out.push_str(&process_inline_formatting(&buf));
    }
    out
}

fn process_inline_formatting(text: &str) -> String {
    let mut result = text.to_string();

    // Images: ![alt](url)
    result = regex_replace(&result, r"!\[([^\]]*)\]\(([^)]+)\)", |caps: &[&str]| {
        format!("<img src=\"{}\" alt=\"{}\" style=\"max-width:100%\" />", caps[2], caps[1])
    });

    // Links: [text](url)
    result = regex_replace(&result, r"\[([^\]]+)\]\(([^)]+)\)", |caps: &[&str]| {
        format!("<a href=\"{}\" target=\"_blank\" rel=\"noopener\">{}</a>", caps[2], caps[1])
    });

    // Bold + italic: ***text*** or ___text___
    result = regex_replace(&result, r"\*\*\*(.+?)\*\*\*", |caps: &[&str]| {
        format!("<strong><em>{}</em></strong>", caps[1])
    });
    result = regex_replace(&result, r"___(.+?)___", |caps: &[&str]| {
        format!("<strong><em>{}</em></strong>", caps[1])
    });

    // Bold: **text** or __text__
    result = regex_replace(&result, r"\*\*(.+?)\*\*", |caps: &[&str]| {
        format!("<strong>{}</strong>", caps[1])
    });
    result = regex_replace(&result, r"__(.+?)__", |caps: &[&str]| {
        format!("<strong>{}</strong>", caps[1])
    });

    // Italic: *text* or _text_
    result = regex_replace(&result, r"\*(.+?)\*", |caps: &[&str]| {
        format!("<em>{}</em>", caps[1])
    });
    result = regex_replace(&result, r"_(.+?)_", |caps: &[&str]| {
        format!("<em>{}</em>", caps[1])
    });

    // Strikethrough: ~~text~~
    result = regex_replace(&result, r"~~(.+?)~~", |caps: &[&str]| {
        format!("<del>{}</del>", caps[1])
    });

    result
}

fn regex_replace(text: &str, pattern: &str, replacer: impl Fn(&[&str]) -> String) -> String {
    let re = regex::Regex::new(pattern).unwrap();
    let mut result = String::new();
    let mut last_end = 0;
    for caps in re.captures_iter(text) {
        let m = caps.get(0).unwrap();
        result.push_str(&text[last_end..m.start()]);
        let groups: Vec<&str> = (0..caps.len()).map(|i| caps.get(i).map_or("", |m| m.as_str())).collect();
        result.push_str(&replacer(&groups));
        last_end = m.end();
    }
    result.push_str(&text[last_end..]);
    result
}

fn markdown_to_html(input: &str) -> String {
    let lines: Vec<&str> = input.lines().collect();
    let mut html = String::new();
    let mut i = 0;
    let mut in_ul = false;
    let mut in_ol = false;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        // Close lists if the current line isn't a list item
        if in_ul && !trimmed.starts_with("- ") && !trimmed.starts_with("* ") && !trimmed.starts_with("+ ") {
            html.push_str("</ul>\n");
            in_ul = false;
        }
        if in_ol && !matches_ordered_list(trimmed) {
            html.push_str("</ol>\n");
            in_ol = false;
        }

        // Fenced code block
        if trimmed.starts_with("```") {
            let lang = trimmed[3..].trim();
            let lang_attr = if lang.is_empty() {
                String::new()
            } else {
                format!(" class=\"language-{}\"", escape_html(lang))
            };
            html.push_str(&format!("<pre><code{}>\n", lang_attr));
            i += 1;
            while i < lines.len() && !lines[i].trim().starts_with("```") {
                html.push_str(&escape_html(lines[i]));
                html.push('\n');
                i += 1;
            }
            html.push_str("</code></pre>\n");
            i += 1;
            continue;
        }

        // Empty line
        if trimmed.is_empty() {
            i += 1;
            continue;
        }

        // Horizontal rule
        if matches!(trimmed, "---" | "***" | "___")
            || (trimmed.len() >= 3 && trimmed.chars().all(|c| c == '-' || c == ' ') && trimmed.contains('-'))
            || (trimmed.len() >= 3 && trimmed.chars().all(|c| c == '*' || c == ' ') && trimmed.contains('*'))
        {
            html.push_str("<hr />\n");
            i += 1;
            continue;
        }

        // Headings
        if let Some(level) = heading_level(trimmed) {
            let content = trimmed[level..].trim_start_matches(' ');
            html.push_str(&format!("<h{}>{}</h{}>\n", level, process_inline(content), level));
            i += 1;
            continue;
        }

        // Blockquote
        if trimmed.starts_with("> ") || trimmed == ">" {
            html.push_str("<blockquote>");
            let content = if trimmed.len() > 2 { &trimmed[2..] } else { "" };
            html.push_str(&process_inline(content));
            html.push_str("</blockquote>\n");
            i += 1;
            continue;
        }

        // Unordered list
        if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
            if !in_ul {
                html.push_str("<ul>\n");
                in_ul = true;
            }
            html.push_str(&format!("<li>{}</li>\n", process_inline(&trimmed[2..])));
            i += 1;
            continue;
        }

        // Ordered list
        if let Some(content) = ordered_list_content(trimmed) {
            if !in_ol {
                html.push_str("<ol>\n");
                in_ol = true;
            }
            html.push_str(&format!("<li>{}</li>\n", process_inline(content)));
            i += 1;
            continue;
        }

        // Paragraph
        html.push_str(&format!("<p>{}</p>\n", process_inline(trimmed)));
        i += 1;
    }

    if in_ul {
        html.push_str("</ul>\n");
    }
    if in_ol {
        html.push_str("</ol>\n");
    }

    html
}

fn heading_level(line: &str) -> Option<usize> {
    let count = line.chars().take_while(|&c| c == '#').count();
    if count >= 1 && count <= 6 && line.chars().nth(count) == Some(' ') {
        Some(count)
    } else {
        None
    }
}

fn matches_ordered_list(line: &str) -> bool {
    ordered_list_content(line).is_some()
}

fn ordered_list_content(line: &str) -> Option<&str> {
    let digits: usize = line.chars().take_while(|c| c.is_ascii_digit()).count();
    if digits > 0 && line[digits..].starts_with(". ") {
        Some(&line[digits + 2..])
    } else {
        None
    }
}

#[tauri::command]
pub fn markdown_render(text: String) -> MarkdownResult {
    let html = markdown_to_html(&text);
    let word_count = text.split_whitespace().count();
    let line_count = if text.is_empty() { 0 } else { text.lines().count() };
    let char_count = text.chars().count();

    MarkdownResult {
        html,
        word_count,
        line_count,
        char_count,
    }
}

#[tauri::command]
pub fn markdown_word_count(text: String) -> usize {
    text.split_whitespace().count()
}
