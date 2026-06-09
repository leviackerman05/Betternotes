use crate::jira_nlp;
use crate::keychain;
use crate::models::{
    AppSettings, JiraCreateRequest, JiraCredentials, JiraIssue, JiraSearchIntent,
    JiraSearchResponse, JiraSprint, JiraUser,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const CACHE_TTL: Duration = Duration::from_secs(60);
const ISSUE_FIELDS: &str =
    "summary,status,assignee,priority,description,issuetype,reporter,customfield_10016";

#[derive(Clone)]
struct CacheEntry {
    issue: JiraIssue,
    expires: Instant,
}

static ISSUE_CACHE: Mutex<Option<HashMap<String, CacheEntry>>> = Mutex::new(None);
static SIDEBAR_ISSUES_CACHE: Mutex<Option<(String, Instant, Vec<JiraIssue>)>> = Mutex::new(None);

fn creds() -> Result<JiraCredentials, String> {
    keychain::get_jira_credentials()?.ok_or_else(|| {
        "Jira not configured. Add credentials in Settings.".into()
    })
}

fn base_url(creds: &JiraCredentials) -> String {
    creds.site_url.trim_end_matches('/').to_string()
}

fn auth_header(creds: &JiraCredentials) -> String {
    use base64::Engine;
    let token = format!("{}:{}", creds.email, creds.api_token);
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(token.as_bytes())
    )
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}

fn plain_text_from_adf(v: &Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = v.as_array() {
        let parts: Vec<String> = arr.iter().filter_map(plain_text_from_adf).collect();
        return if parts.is_empty() {
            None
        } else {
            Some(parts.join("\n"))
        };
    }
    if let Some(text) = v.get("text").and_then(|t| t.as_str()) {
        return Some(text.to_string());
    }
    if let Some(content) = v.get("content") {
        return plain_text_from_adf(content);
    }
    None
}

fn text_to_adf(text: &str) -> Value {
    json!({
        "type": "doc",
        "version": 1,
        "content": [{
            "type": "paragraph",
            "content": [{ "type": "text", "text": text }]
        }]
    })
}

fn parse_issue(key: &str, body: &Value, site: &str) -> Result<JiraIssue, String> {
    let fields = body.get("fields").ok_or("Missing fields in Jira response")?;
    let summary = fields
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or(key)
        .to_string();
    let status_name = fields
        .pointer("/status/name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let status_category = fields
        .pointer("/status/statusCategory/key")
        .and_then(|v| v.as_str())
        .unwrap_or("undefined")
        .to_string();
    let assignee = fields
        .pointer("/assignee/displayName")
        .and_then(|v| v.as_str())
        .map(String::from);
    let priority = fields
        .pointer("/priority/name")
        .and_then(|v| v.as_str())
        .map(String::from);
    let description = fields
        .get("description")
        .and_then(plain_text_from_adf)
        .filter(|s| !s.trim().is_empty());
    let issue_type = fields
        .pointer("/issuetype/name")
        .and_then(|v| v.as_str())
        .map(String::from);
    let reporter = fields
        .pointer("/reporter/displayName")
        .and_then(|v| v.as_str())
        .map(String::from);
    let story_points = fields
        .get("customfield_10016")
        .and_then(|v| v.as_f64());

    Ok(JiraIssue {
        key: key.to_string(),
        summary,
        status: status_name,
        status_category,
        assignee,
        priority,
        url: format!("{site}/browse/{key}"),
        description,
        issue_type,
        reporter,
        story_points,
    })
}

async fn jql_search(jql: &str, max_results: u32) -> Result<Vec<JiraIssue>, String> {
    let creds = creds()?;
    let site = base_url(&creds);
    let url = format!("{site}/rest/api/3/search/jql");
    let body = json!({
        "jql": jql,
        "maxResults": max_results,
        "fields": ISSUE_FIELDS.split(',').collect::<Vec<_>>()
    });

    let resp = client()?
        .post(&url)
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Jira search failed ({status}): {text}"));
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let issues_arr = body
        .get("issues")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut issues = Vec::new();
    for item in issues_arr {
        let key = item.get("key").and_then(|v| v.as_str()).unwrap_or("");
        if key.is_empty() {
            continue;
        }
        if let Ok(issue) = parse_issue(key, &item, &site) {
            issues.push(issue);
        }
    }
    Ok(issues)
}

pub async fn get_issue(key: &str) -> Result<JiraIssue, String> {
    let key = key.trim().to_uppercase();
    if key.is_empty() {
        return Err("Issue key required".into());
    }

    {
        let cache = ISSUE_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some(map) = cache.as_ref() {
            if let Some(entry) = map.get(&key) {
                if entry.expires > Instant::now() {
                    return Ok(entry.issue.clone());
                }
            }
        }
    }

    let creds = creds()?;
    let site = base_url(&creds);
    let url = format!("{site}/rest/api/3/issue/{key}?fields={ISSUE_FIELDS}");
    let resp = client()?
        .get(&url)
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Jira error ({status}): {text}"));
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let issue = parse_issue(&key, &body, &site)?;

    {
        let mut cache = ISSUE_CACHE.lock().map_err(|e| e.to_string())?;
        let map = cache.get_or_insert_with(HashMap::new);
        map.insert(
            key,
            CacheEntry {
                issue: issue.clone(),
                expires: Instant::now() + CACHE_TTL,
            },
        );
    }

    Ok(issue)
}

fn escape_jql_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

pub const DEFAULT_MY_ISSUES_JQL: &str = "assignee = currentUser() AND statusCategory != Done AND (sprint in openSprints() OR sprint IS EMPTY) ORDER BY updated DESC";

fn inject_project_if_missing(jql: &str, project_key: &str) -> String {
    if project_key.is_empty() || jql.to_lowercase().contains("project =") {
        return jql.to_string();
    }
    let lower = jql.to_lowercase();
    if let Some(idx) = lower.find(" order by ") {
        let (before, after) = jql.split_at(idx);
        format!(
            "{} AND project = \"{}\"{}",
            before.trim_end(),
            escape_jql_string(project_key),
            after
        )
    } else {
        format!(
            "{} AND project = \"{}\"",
            jql.trim_end(),
            escape_jql_string(project_key)
        )
    }
}

pub fn resolve_my_issues_jql(custom: &str, project_key: &str) -> String {
    if !custom.trim().is_empty() {
        return custom.trim().to_string();
    }
    inject_project_if_missing(DEFAULT_MY_ISSUES_JQL, project_key)
}

fn is_sprint_jql_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("sprint") || lower.contains("opensprints")
}

async fn my_open_issues_for_project(project_key: &str) -> Result<Vec<JiraIssue>, String> {
    let mut clauses = vec![
        "assignee = currentUser()".to_string(),
        "statusCategory != Done".to_string(),
    ];
    if !project_key.is_empty() {
        clauses.push(format!(
            "project = \"{}\"",
            escape_jql_string(project_key)
        ));
    }
    let jql = format!("{} ORDER BY updated DESC", clauses.join(" AND "));
    jql_search(&jql, 50).await
}

/// Issues for the sidebar / task sync using the configured JQL query.
pub async fn my_sidebar_issues(jql: &str, force_refresh: bool) -> Result<Vec<JiraIssue>, String> {
    let jql = jql.trim();
    if jql.is_empty() {
        return Err("Jira issues query is empty. Set a JQL query in Settings → Jira.".into());
    }

    if !force_refresh {
        let cache = SIDEBAR_ISSUES_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some((key, expires, issues)) = cache.as_ref() {
            if key == jql && *expires > Instant::now() {
                return Ok(issues.clone());
            }
        }
    }

    let uses_sprint = jql.to_lowercase().contains("sprint");
    let issues = match jql_search(jql, 50).await {
        Ok(issues) => issues,
        Err(e) if uses_sprint && is_sprint_jql_error(&e) => {
            let fallback = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
            jql_search(fallback, 50).await?
        }
        Err(e) => return Err(e),
    };

    {
        let mut cache = SIDEBAR_ISSUES_CACHE.lock().map_err(|e| e.to_string())?;
        *cache = Some((jql.to_string(), Instant::now() + CACHE_TTL, issues.clone()));
    }

    Ok(issues)
}

/// All open issues assigned to the current user (used by search fallbacks).
pub async fn my_open_issues() -> Result<Vec<JiraIssue>, String> {
    my_open_issues_for_project("").await
}

fn normalize_nl_query(query: &str) -> String {
    let mut q = query.to_string();
    for (from, to) in [
        ("assiged", "assigned"),
        ("assinged", "assigned"),
        ("assigne ", "assignee "),
        ("asigned", "assigned"),
        ("assing", "assign"),
    ] {
        q = q.replace(from, to);
    }
    q
}

fn extract_assignee_hint(query: &str) -> Option<String> {
    let normalized = normalize_nl_query(query);
    let lower = normalized.to_lowercase();

    // "… assigned to Priyansh Singh", tolerant of typos before "to"
    if lower.contains("assign") || lower.contains("owned") || lower.contains("ticket") {
        if let Some(idx) = lower.rfind(" to ") {
            let rest = normalized[idx + 4..].trim();
            if rest.len() >= 2 {
                return Some(rest.to_string());
            }
        }
    }

    for prefix in [
        "assigned to ",
        "assignee is ",
        "assignee ",
        "owned by ",
        "tickets for ",
        "for ",
    ] {
        if let Some(idx) = lower.find(prefix) {
            let rest = normalized[idx + prefix.len()..].trim();
            if rest.len() >= 2 {
                return Some(rest.to_string());
            }
        }
    }
    None
}

fn clean_text_query(query: &str) -> String {
    const STOP: &[&str] = &[
        "ticket", "tickets", "assigned", "assignee", "owned", "find", "show", "get", "the", "a",
        "an", "my", "to", "is", "in", "on", "for", "by",
    ];
    normalize_nl_query(query)
        .split_whitespace()
        .filter(|w| !STOP.contains(&w.to_lowercase().as_str()))
        .collect::<Vec<_>>()
        .join(" ")
}

async fn search_assignable_users(query: &str, project_key: &str) -> Result<Vec<JiraUser>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(vec![]);
    }

    let creds = creds()?;
    let site = base_url(&creds);
    let url = format!("{site}/rest/api/3/user/assignable/multiProjectSearch");

    let resp = client()?
        .get(&url)
        .query(&[
            ("query", query),
            ("projectKeys", project_key),
            ("maxResults", "12"),
        ])
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Assignable user search failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parse_users_json(&body))
}

fn parse_users_json(body: &Value) -> Vec<JiraUser> {
    body.as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|u| {
            let account_id = u.get("accountId")?.as_str()?.to_string();
            let display_name = u
                .get("displayName")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let email = u.get("emailAddress").and_then(|v| v.as_str()).map(String::from);
            Some(JiraUser {
                account_id,
                display_name,
                email,
            })
        })
        .collect()
}

async fn search_users_fuzzy(name: &str, project_key: Option<&str>) -> Result<Vec<JiraUser>, String> {
    let name = name.trim();
    if name.is_empty() {
        return Ok(vec![]);
    }

    let pk = project_key.filter(|p| !p.is_empty());

    let mut users = search_users(name).await?;
    if users.is_empty() {
        if let Some(project) = pk {
            users = search_assignable_users(name, project).await?;
        }
    }
    if users.is_empty() {
        if let Some(first) = name.split_whitespace().next() {
            if first.len() >= 3 {
                users = search_users(first).await?;
                if users.is_empty() {
                    if let Some(project) = pk {
                        users = search_assignable_users(first, project).await?;
                    }
                }
            }
        }
    }
    Ok(users)
}

async fn issues_for_assignees(users: &[JiraUser], include_done: bool) -> Result<Vec<JiraIssue>, String> {
    if users.is_empty() {
        return Ok(vec![]);
    }

    let status_clause = if include_done {
        String::new()
    } else {
        " AND statusCategory != Done".to_string()
    };

    let ids: Vec<String> = users
        .iter()
        .take(5)
        .map(|u| format!("\"{}\"", u.account_id))
        .collect();
    let jql = format!(
        "assignee in ({}){status_clause} ORDER BY updated DESC",
        ids.join(", ")
    );
    let issues = jql_search(&jql, 40).await?;
    if !issues.is_empty() || include_done {
        return Ok(issues);
    }

    // Fallback: match by display name (some Jira sites support this)
    let name = users[0].display_name.replace('\\', "\\\\").replace('"', "\\\"");
    let jql = format!(
        "assignee = \"{name}\"{status_clause} ORDER BY updated DESC"
    );
    jql_search(&jql, 40).await
}

fn is_issue_key(query: &str) -> bool {
    query
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
        && query.contains('-')
        && query
            .split('-')
            .next()
            .map(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphabetic()))
            .unwrap_or(false)
}

async fn execute_search_intent(intent: &JiraSearchIntent) -> Result<Vec<JiraIssue>, String> {
    if let Some(key) = intent.issue_key.as_ref().filter(|k| !k.is_empty()) {
        return Ok(vec![get_issue(key).await?]);
    }

    let mut clauses: Vec<String> = Vec::new();

    if !intent.include_done {
        clauses.push("statusCategory != Done".to_string());
    }

    if intent.only_mine {
        clauses.push("assignee = currentUser()".to_string());
    }

    if let Some(project) = intent.project.as_ref().filter(|p| !p.is_empty()) {
        let p = project.trim().to_uppercase();
        clauses.push(format!("project = {p}"));
    }

    let project_hint = intent.project.as_deref().filter(|p| !p.is_empty());

    if let Some(assignee) = intent.assignee.as_ref().filter(|a| !a.is_empty()) {
        let users = search_users_fuzzy(assignee, project_hint).await?;
        if users.is_empty() {
            return Ok(vec![]);
        }
        let ids: Vec<String> = users
            .iter()
            .take(5)
            .map(|u| format!("\"{}\"", u.account_id))
            .collect();
        clauses.push(format!("assignee in ({})", ids.join(", ")));
    }

    if let Some(reporter) = intent.reporter.as_ref().filter(|r| !r.is_empty()) {
        let users = search_users_fuzzy(reporter, project_hint).await?;
        if !users.is_empty() {
            let id = &users[0].account_id;
            clauses.push(format!("reporter = \"{id}\""));
        }
    }

    if let Some(status) = intent.status.as_ref().filter(|s| !s.is_empty()) {
        let s = status.replace('\\', "\\\\").replace('"', "\\\"");
        clauses.push(format!("status = \"{s}\""));
    }

    if let Some(keywords) = intent.keywords.as_ref().filter(|k| !k.is_empty()) {
        let e = keywords.replace('\\', "\\\\").replace('"', "\\\"");
        clauses.push(format!(
            "(summary ~ \"\\\"{e}\\\"\" OR text ~ \"\\\"{e}\\\"\")"
        ));
    }

    if clauses.is_empty() {
        return my_open_issues().await;
    }

    let jql = format!("{} ORDER BY updated DESC", clauses.join(" AND "));
    let issues = jql_search(&jql, 40).await?;
    if !issues.is_empty() || !intent.include_done {
        return Ok(issues);
    }

    // Retry without status filter if nothing found
    let open_clauses: Vec<String> = clauses
        .into_iter()
        .filter(|c| !c.starts_with("statusCategory"))
        .collect();
    if open_clauses.is_empty() {
        return Ok(vec![]);
    }
    let jql = format!("{} ORDER BY updated DESC", open_clauses.join(" AND "));
    jql_search(&jql, 40).await
}

/// Fast rule-based search, no LLM.
async fn search_issues_rules(query: &str, project_key: Option<&str>) -> Result<Vec<JiraIssue>, String> {
    if let Some(assignee_hint) = extract_assignee_hint(query) {
        let users = search_users_fuzzy(&assignee_hint, project_key).await?;
        let issues = issues_for_assignees(&users, false).await?;
        if !issues.is_empty() {
            return Ok(issues);
        }
        // Include done tickets if nothing open
        let issues = issues_for_assignees(&users, true).await?;
        if !issues.is_empty() {
            return Ok(issues);
        }
    }

    let text = clean_text_query(query);
    let search_text = if text.is_empty() { query.to_string() } else { text };

    let escaped = search_text.replace('\\', "\\\\").replace('"', "\\\"");
    let jql = format!(
        "statusCategory != Done AND (summary ~ \"\\\"{escaped}\\\"\" OR text ~ \"\\\"{escaped}\\\"\") ORDER BY updated DESC"
    );
    let mut issues = jql_search(&jql, 25).await?;

    if issues.is_empty() {
        let words: Vec<&str> = search_text
            .split_whitespace()
            .filter(|w| w.len() > 2)
            .take(5)
            .collect();
        if !words.is_empty() {
            let clauses: Vec<String> = words
                .iter()
                .map(|w| {
                    let e = w.replace('\\', "\\\\").replace('"', "\\\"");
                    format!("(summary ~ \"{e}*\" OR text ~ \"{e}*\")")
                })
                .collect();
            let jql = format!(
                "statusCategory != Done AND ({}) ORDER BY updated DESC",
                clauses.join(" OR ")
            );
            issues = jql_search(&jql, 25).await?;
        }
    }

    // Plain name like "Priyansh Singh" with no assign keyword
    if issues.is_empty() && search_text.split_whitespace().count() >= 2 {
        let users = search_users_fuzzy(&search_text, project_key).await?;
        issues = issues_for_assignees(&users, false).await?;
        if issues.is_empty() {
            issues = issues_for_assignees(&users, true).await?;
        }
    }

    if issues.is_empty() {
        let jql = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
        let mine = jql_search(jql, 50).await?;
        let q = search_text.to_lowercase();
        issues = mine
            .into_iter()
            .filter(|i| {
                i.summary.to_lowercase().contains(&q)
                    || i.key.to_lowercase().contains(&q)
                    || i.assignee
                        .as_ref()
                        .map(|a| a.to_lowercase().contains(&q))
                        .unwrap_or(false)
                    || i.description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&q))
                        .unwrap_or(false)
            })
            .collect();
    }

    Ok(issues)
}

/// Rules first (instant), Ollama NLP if rules find nothing.
pub async fn search_issues(query: &str, settings: &AppSettings) -> Result<JiraSearchResponse, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(JiraSearchResponse {
            issues: my_open_issues().await?,
            used_ai: false,
        });
    }

    if is_issue_key(query) {
        if let Ok(issue) = get_issue(&query.to_uppercase()).await {
            return Ok(JiraSearchResponse {
                issues: vec![issue],
                used_ai: false,
            });
        }
    }

    let project_key = if settings.default_jira_project_key.is_empty() {
        None
    } else {
        Some(settings.default_jira_project_key.as_str())
    };

    let rule_results = search_issues_rules(query, project_key).await?;
    if !rule_results.is_empty() {
        return Ok(JiraSearchResponse {
            issues: rule_results,
            used_ai: false,
        });
    }

    if !crate::integrations::is_local_ai_enabled(settings) {
        return Ok(JiraSearchResponse {
            issues: vec![],
            used_ai: false,
        });
    }

    let intent = jira_nlp::parse_query_with_ollama(settings, query).await?;
    let issues = execute_search_intent(&intent).await?;
    Ok(JiraSearchResponse {
        issues,
        used_ai: true,
    })
}

pub async fn search_users(query: &str) -> Result<Vec<JiraUser>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(vec![]);
    }

    let creds = creds()?;
    let site = base_url(&creds);
    let url = format!("{site}/rest/api/3/user/search");

    let resp = client()?
        .get(&url)
        .query(&[("query", query), ("maxResults", "12")])
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("User search failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("User search failed ({status}): {text}"));
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parse_users_json(&body))
}

pub async fn list_sprints(project_key: &str) -> Result<Vec<JiraSprint>, String> {
    let project_key = project_key.trim().to_uppercase();
    let creds = creds()?;
    let site = base_url(&creds);

    let boards_url = format!("{site}/rest/agile/1.0/board?projectKeyOrId={project_key}");
    let boards_resp = client()?
        .get(&boards_url)
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Board lookup failed: {e}"))?;

    if !boards_resp.status().is_success() {
        return Ok(vec![]);
    }

    let boards_body: Value = boards_resp.json().await.map_err(|e| e.to_string())?;
    let board_id = boards_body
        .get("values")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|b| b.get("id"))
        .and_then(|v| v.as_i64());

    let Some(board_id) = board_id else {
        return Ok(vec![]);
    };

    let sprints_url =
        format!("{site}/rest/agile/1.0/board/{board_id}/sprint?state=active,future");
    let resp = client()?
        .get(&sprints_url)
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Sprint lookup failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let sprints = body
        .get("values")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| {
            Some(JiraSprint {
                id: s.get("id")?.as_i64()?,
                name: s.get("name")?.as_str()?.to_string(),
                state: s.get("state")?.as_str()?.to_string(),
            })
        })
        .collect();
    Ok(sprints)
}

pub async fn create_issue(req: &JiraCreateRequest) -> Result<JiraIssue, String> {
    let project_key = req.project_key.trim().to_uppercase();
    let summary = req.summary.trim();
    if project_key.is_empty() || summary.is_empty() {
        return Err("Project key and summary are required".into());
    }

    let creds = creds()?;
    let site = base_url(&creds);
    let issue_type = req.issue_type.as_deref().unwrap_or("Task");

    let mut fields = json!({
        "project": { "key": project_key },
        "summary": summary,
        "issuetype": { "name": issue_type }
    });

    if let Some(desc) = req.description.as_ref().filter(|d| !d.trim().is_empty()) {
        fields["description"] = text_to_adf(desc);
    }
    if let Some(account_id) = req.assignee_account_id.as_ref() {
        fields["assignee"] = json!({ "accountId": account_id });
    }
    if let Some(account_id) = req.reporter_account_id.as_ref() {
        fields["reporter"] = json!({ "accountId": account_id });
    }
    if let Some(points) = req.story_points {
        fields["customfield_10016"] = json!(points);
    }

    let url = format!("{site}/rest/api/3/issue");
    let body = json!({ "fields": fields });

    let resp = client()?
        .post(&url)
        .header("Authorization", auth_header(&creds))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Create issue failed ({status}): {text}"));
    }

    let created: Value = resp.json().await.map_err(|e| e.to_string())?;
    let key = created
        .get("key")
        .and_then(|v| v.as_str())
        .ok_or("Jira did not return issue key")?;

    if let Some(sprint_id) = req.sprint_id {
        let sprint_url = format!("{site}/rest/agile/1.0/sprint/{sprint_id}/issue");
        let _ = client()?
            .post(&sprint_url)
            .header("Authorization", auth_header(&creds))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .json(&json!({ "issues": [key] }))
            .send()
            .await;
    }

    get_issue(key).await
}
