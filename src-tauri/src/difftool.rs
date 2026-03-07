//! Diff Tool - Compare two text inputs and show differences
//!
//! Provides:
//! - Line-by-line diff comparison
//! - Character-level diff for single lines
//! - Unified diff output format
//! - Diff statistics (additions, deletions, changes)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String, // "equal", "added", "removed"
    pub content: String,
    pub left_line: Option<usize>,
    pub right_line: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub lines: Vec<DiffLine>,
    pub additions: usize,
    pub deletions: usize,
    pub unchanged: usize,
    pub total_left: usize,
    pub total_right: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedDiffResult {
    pub diff_text: String,
    pub has_changes: bool,
}

#[tauri::command]
pub fn diff_compare(left: String, right: String) -> DiffResult {
    let left_lines: Vec<&str> = left.lines().collect();
    let right_lines: Vec<&str> = right.lines().collect();

    let lcs = compute_lcs(&left_lines, &right_lines);
    let mut result_lines = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;
    let mut unchanged = 0;

    let mut li = 0;
    let mut ri = 0;
    let mut ci = 0;

    while li < left_lines.len() || ri < right_lines.len() {
        if ci < lcs.len() && li < left_lines.len() && ri < right_lines.len() && left_lines[li] == lcs[ci] && right_lines[ri] == lcs[ci] {
            result_lines.push(DiffLine {
                kind: "equal".to_string(),
                content: left_lines[li].to_string(),
                left_line: Some(li + 1),
                right_line: Some(ri + 1),
            });
            unchanged += 1;
            li += 1;
            ri += 1;
            ci += 1;
        } else if ci < lcs.len() && ri < right_lines.len() && right_lines[ri] == lcs[ci] {
            // Left has extra line (removed)
            result_lines.push(DiffLine {
                kind: "removed".to_string(),
                content: left_lines[li].to_string(),
                left_line: Some(li + 1),
                right_line: None,
            });
            deletions += 1;
            li += 1;
        } else if ci < lcs.len() && li < left_lines.len() && left_lines[li] == lcs[ci] {
            // Right has extra line (added)
            result_lines.push(DiffLine {
                kind: "added".to_string(),
                content: right_lines[ri].to_string(),
                left_line: None,
                right_line: Some(ri + 1),
            });
            additions += 1;
            ri += 1;
        } else {
            // Neither matches LCS - removed from left, or we're past LCS
            if li < left_lines.len() && (ci >= lcs.len() || left_lines[li] != lcs[ci]) {
                result_lines.push(DiffLine {
                    kind: "removed".to_string(),
                    content: left_lines[li].to_string(),
                    left_line: Some(li + 1),
                    right_line: None,
                });
                deletions += 1;
                li += 1;
            }
            if ri < right_lines.len() && (ci >= lcs.len() || right_lines[ri] != lcs[ci]) {
                result_lines.push(DiffLine {
                    kind: "added".to_string(),
                    content: right_lines[ri].to_string(),
                    left_line: None,
                    right_line: Some(ri + 1),
                });
                additions += 1;
                ri += 1;
            }
        }
    }

    DiffResult {
        lines: result_lines,
        additions,
        deletions,
        unchanged,
        total_left: left_lines.len(),
        total_right: right_lines.len(),
    }
}

#[tauri::command]
pub fn diff_unified(left: String, right: String, context_lines: Option<usize>) -> UnifiedDiffResult {
    let ctx = context_lines.unwrap_or(3);
    let left_lines: Vec<&str> = left.lines().collect();
    let right_lines: Vec<&str> = right.lines().collect();

    let diff = diff_compare(left.clone(), right.clone());
    let has_changes = diff.additions > 0 || diff.deletions > 0;

    if !has_changes {
        return UnifiedDiffResult {
            diff_text: String::new(),
            has_changes: false,
        };
    }

    let mut output = String::new();
    output.push_str("--- left\n");
    output.push_str("+++ right\n");

    // Build unified diff with context
    let mut i = 0;
    while i < diff.lines.len() {
        if diff.lines[i].kind != "equal" {
            // Found a change - determine context range
            let start = if i > ctx { i - ctx } else { 0 };
            let mut end = i;
            while end < diff.lines.len() && (diff.lines[end].kind != "equal" || {
                let next_change = (end + 1..diff.lines.len()).find(|&j| diff.lines[j].kind != "equal");
                next_change.map_or(false, |nc| nc - end <= ctx * 2)
            }) {
                end += 1;
            }
            end = (end + ctx).min(diff.lines.len());

            // Emit hunk header
            let left_start = diff.lines[start].left_line.unwrap_or(1);
            let right_start = diff.lines[start].right_line.unwrap_or(1);
            let left_count = diff.lines[start..end].iter().filter(|l| l.kind != "added").count();
            let right_count = diff.lines[start..end].iter().filter(|l| l.kind != "removed").count();
            output.push_str(&format!("@@ -{},{} +{},{} @@\n", left_start, left_count, right_start, right_count));

            for line in &diff.lines[start..end] {
                match line.kind.as_str() {
                    "equal" => output.push_str(&format!(" {}\n", line.content)),
                    "added" => output.push_str(&format!("+{}\n", line.content)),
                    "removed" => output.push_str(&format!("-{}\n", line.content)),
                    _ => {}
                }
            }

            i = end;
        } else {
            i += 1;
        }
    }

    UnifiedDiffResult {
        diff_text: output,
        has_changes,
    }
}

#[tauri::command]
pub fn diff_stats(left: String, right: String) -> DiffResult {
    diff_compare(left, right)
}

fn compute_lcs<'a>(left: &[&'a str], right: &[&'a str]) -> Vec<&'a str> {
    let m = left.len();
    let n = right.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if left[i - 1] == right[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    let mut result = Vec::new();
    let mut i = m;
    let mut j = n;
    while i > 0 && j > 0 {
        if left[i - 1] == right[j - 1] {
            result.push(left[i - 1]);
            i -= 1;
            j -= 1;
        } else if dp[i - 1][j] > dp[i][j - 1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }
    result.reverse();
    result
}
