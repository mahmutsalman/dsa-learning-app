use tauri::State;
use crate::models::*;

#[tauri::command]
pub async fn init_database(_state: State<'_, AppState>) -> Result<String, String> {
    // Database is already initialized in main.rs
    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
pub async fn connect_database(state: State<'_, AppState>) -> Result<String, String> {
    // Test database connection and return status
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Quick connection test - count problems
    match db.get_problems() {
        Ok(problems) => {
            Ok(format!("Connected to database successfully. Found {} problems.", problems.len()))
        },
        Err(e) => {
            Err(format!("Database connection failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn create_problem(
    state: State<'_, AppState>,
    request: CreateProblemRequest,
) -> Result<FrontendProblem, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_problem(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problems(state: State<'_, AppState>) -> Result<Vec<FrontendProblem>, String> {
    eprintln!("🔍 Rust: get_problems called, acquiring database lock...");
    let db = state.db.lock().map_err(|e| {
        eprintln!("❌ Rust: Failed to acquire database lock in get_problems: {}", e);
        e.to_string()
    })?;
    
    match db.get_problems() {
        Ok(problems) => {
            eprintln!("✅ Rust: get_problems returning {} problems", problems.len());
            if problems.len() > 0 {
                eprintln!("📝 Rust: Problem titles being returned:");
                for (i, p) in problems.iter().enumerate() {
                    eprintln!("  {}. {} (ID: {})", i + 1, p.title, p.id);
                }
            } else {
                eprintln!("📝 Rust: No problems found in database");
            }
            Ok(problems)
        },
        Err(e) => {
            eprintln!("❌ Rust: get_problems failed with error: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn get_problem_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_problem(
    state: State<'_, AppState>,
    request: UpdateProblemRequest,
) -> Result<FrontendProblem, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.update_problem(request) {
        Ok(Some(problem)) => Ok(problem),
        Ok(None) => Err("Problem not found".to_string()),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub async fn delete_problem(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    eprintln!("🗑️ Rust: delete_problem called for ID: {}", id);
    let mut db = state.db.lock().map_err(|e| {
        eprintln!("❌ Rust: Failed to acquire database lock in delete_problem: {}", e);
        e.to_string()
    })?;
    
    match db.delete_problem(&id) {
        Ok(()) => {
            eprintln!("✅ Rust: Successfully deleted problem with ID: {}", id);
            Ok("Problem deleted successfully".to_string())
        },
        Err(e) => {
            eprintln!("❌ Rust: Failed to delete problem with ID {}: {}", id, e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn create_card(
    state: State<'_, AppState>,
    request: CreateCardRequest,
) -> Result<Card, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_card(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cards_for_problem(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<Card>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_cards_for_problem(&problem_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_card_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Card>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_card(
    state: State<'_, AppState>,
    card_id: String,
    code: Option<String>,
    notes: Option<String>,
    language: Option<String>,
    status: Option<String>,
) -> Result<Option<Card>, String> {
    let request = UpdateCardRequest {
        id: card_id,
        code,
        notes,
        language,
        status,
    };
    
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_card(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_card(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    match db.delete_card(&id) {
        Ok(()) => Ok("Card deleted successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

// Database analysis commands
#[tauri::command]
pub async fn get_database_stats(state: State<'_, AppState>) -> Result<DatabaseStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_database_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_card_hierarchy(state: State<'_, AppState>) -> Result<Vec<CardHierarchy>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_hierarchy().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cards_per_problem(state: State<'_, AppState>) -> Result<Vec<CardCountPerProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_cards_per_problem().map_err(|e| e.to_string())
}

// Tag management commands
#[tauri::command]
pub async fn get_problem_tags(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_tags(&problem_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_problem_tag(
    state: State<'_, AppState>,
    request: AddProblemTagRequest,
) -> Result<Tag, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_problem_tag(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_problem_tag(
    state: State<'_, AppState>,
    request: RemoveProblemTagRequest,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.remove_problem_tag(request) {
        Ok(()) => Ok("Tag removed successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn get_tag_suggestions(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_tag_suggestions(&query, limit.unwrap_or(10)).map_err(|e| e.to_string())
}

// Bulk tag operations
#[tauri::command]
pub async fn add_tag_to_problems(
    state: State<'_, AppState>,
    problem_ids: Vec<String>,
    tag_name: String,
    category: Option<String>,
) -> Result<Vec<Tag>, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut added_tags = Vec::new();
    let category = category.unwrap_or_else(|| "custom".to_string());
    
    for problem_id in problem_ids {
        let request = AddProblemTagRequest {
            problem_id: problem_id.clone(),
            tag_name: tag_name.clone(),
            color: None,
            category: Some(category.clone()),
        };
        
        match db.add_problem_tag(request) {
            Ok(tag) => {
                // Only add the tag once to the result
                if added_tags.is_empty() || !added_tags.iter().any(|t: &Tag| t.id == tag.id) {
                    added_tags.push(tag);
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to add tag '{}' to problem {}: {}", tag_name, problem_id, e);
            }
        }
    }
    
    Ok(added_tags)
}

#[tauri::command]
pub async fn remove_tag_from_problems(
    state: State<'_, AppState>,
    problem_ids: Vec<String>,
    tag_id: String,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    for problem_id in problem_ids {
        let request = RemoveProblemTagRequest {
            problem_id: problem_id.clone(),
            tag_id: tag_id.clone(),
        };
        
        if let Err(e) = db.remove_problem_tag(request) {
            eprintln!("Warning: Failed to remove tag from problem {}: {}", problem_id, e);
        }
    }
    
    Ok(())
}

// Search commands for Name/Topic/Tags search system
#[tauri::command]
pub async fn search_problems_by_name(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_title(&query, 50, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_problems_by_topic(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_topic(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_problems_by_tags(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_tags(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_search_suggestions(
    state: State<'_, AppState>,
    query: String,
    search_type: String,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    match search_type.as_str() {
        "name" => db.get_title_suggestions(&query).map_err(|e| e.to_string()),
        "topic" => db.get_topic_suggestions(&query).map_err(|e| e.to_string()),
        "tags" => db.get_tag_suggestions(&query, 10).map_err(|e| e.to_string()),
        _ => Err("Invalid search type".to_string()),
    }
}

// Problem connection commands
#[tauri::command]
pub async fn search_problems_for_connection(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i32>,
    exclude_id: Option<String>,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let exclude_id_ref = exclude_id.as_deref();
    db.search_problems_by_title(&query, limit.unwrap_or(10), exclude_id_ref)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_problem_relation(
    state: State<'_, AppState>,
    problem_id: String,
    related_problem_id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.add_problem_relation(&problem_id, &related_problem_id) {
        Ok(()) => Ok("Problem relation added successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn remove_problem_relation(
    state: State<'_, AppState>,
    problem_id: String,
    related_problem_id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.remove_problem_relation(&problem_id, &related_problem_id) {
        Ok(()) => Ok("Problem relation removed successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn get_related_problems(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_related_problems(&problem_id).map_err(|e| e.to_string())
}

// TXT Import system
#[tauri::command]
pub async fn import_problems_from_txt(
    state: State<'_, AppState>,
    content: String,
) -> Result<ImportResult, String> {
    
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut result = ImportResult {
        success: true,
        imported_count: 0,
        skipped_count: 0,
        error_count: 0,
        duplicates: Vec::new(),
        errors: Vec::new(),
    };
    
    // Parse the TXT content
    eprintln!("🔍 Rust: Starting TXT content parsing...");
    let problems = match parse_txt_content(&content) {
        Ok(problems) => {
            eprintln!("✅ Rust: Successfully parsed {} problems", problems.len());
            for (i, problem) in problems.iter().enumerate() {
                eprintln!("📋 Rust: Problem {}: '{}' ({})", i + 1, problem.title, problem.difficulty);
            }
            problems
        },
        Err(e) => {
            eprintln!("❌ Rust: Failed to parse TXT content: {}", e);
            result.success = false;
            result.errors.push(ImportError {
                line: 0,
                field: None,
                message: format!("Failed to parse TXT content: {}", e),
                severity: "error".to_string(),
            });
            return Ok(result);
        }
    };
    
    eprintln!("🔄 Rust: Starting problem import process...");
    
    // Check for duplicates and import problems
    for (index, problem) in problems.iter().enumerate() {
        let line_number = (index + 1) as i32;
        eprintln!("🔍 Rust: Processing problem {}: '{}'", line_number, problem.title);
        
        // Check if problem already exists by title
        match db.search_problems_by_title(&problem.title, 1, None) {
            Ok(existing) if !existing.is_empty() => {
                eprintln!("🔄 Rust: Problem '{}' already exists, skipping", problem.title);
                result.skipped_count += 1;
                result.duplicates.push(problem.title.clone());
                continue;
            },
            Err(e) => {
                eprintln!("❌ Rust: Failed to check duplicate for '{}': {}", problem.title, e);
                result.error_count += 1;
                result.errors.push(ImportError {
                    line: line_number,
                    field: Some("title".to_string()),
                    message: format!("Failed to check for duplicate: {}", e),
                    severity: "error".to_string(),
                });
                continue;
            },
            _ => {
                eprintln!("✅ Rust: Problem '{}' is new, proceeding with import", problem.title);
            }
        }
        
        // Create problem request
        let request = CreateProblemRequest {
            title: problem.title.clone(),
            description: problem.description.clone(),
            difficulty: problem.difficulty.clone(),
            topic: problem.topics.clone(),
            leetcode_url: problem.leetcode_url.clone(),
            constraints: problem.constraints.clone(),
            hints: problem.hints.clone(),
            related_problem_ids: None,
        };
        
        eprintln!("💾 Rust: Creating problem '{}' in database...", problem.title);
        
        // Try to create the problem
        match db.create_problem(request) {
            Ok(created_problem) => {
                eprintln!("✅ Rust: Successfully created problem '{}' with ID: {}", problem.title, created_problem.id);
                result.imported_count += 1;
            },
            Err(e) => {
                eprintln!("❌ Rust: Failed to create problem '{}': {}", problem.title, e);
                result.error_count += 1;
                result.errors.push(ImportError {
                    line: line_number,
                    field: None,
                    message: format!("Failed to create problem: {}", e),
                    severity: "error".to_string(),
                });
            }
        }
    }
    
    // Update overall success status
    result.success = result.error_count == 0;
    
    eprintln!("📊 Rust: Import completed - Success: {}, Imported: {}, Skipped: {}, Errors: {}", 
        result.success, result.imported_count, result.skipped_count, result.error_count);
    
    // Final verification - let's check how many problems are now in the database
    match db.get_problems() {
        Ok(all_problems) => {
            eprintln!("🔍 Rust: Database now contains {} total problems", all_problems.len());
            if all_problems.len() > 0 {
                eprintln!("📝 Rust: Current problem titles in database:");
                for (i, p) in all_problems.iter().enumerate() {
                    eprintln!("  {}. {}", i + 1, p.title);
                }
            }
        },
        Err(e) => {
            eprintln!("❌ Rust: Failed to verify database contents: {}", e);
        }
    }
    
    Ok(result)
}

// Helper function to parse TXT content
fn parse_txt_content(content: &str) -> Result<Vec<ParsedProblem>, String> {
    eprintln!("🔄 Rust: Starting detailed TXT parsing...");
    let mut problems = Vec::new();
    let mut current_problem: Option<ParsedProblem> = None;
    let mut current_field: Option<String> = None;
    let mut current_value = String::new();
    
    let total_lines = content.lines().count();
    eprintln!("📝 Rust: Processing {} lines", total_lines);
    
    for (line_num, line) in content.lines().enumerate() {
        let line = line.trim();
        
        // Skip empty lines
        if line.is_empty() {
            continue;
        }
        
        eprintln!("📄 Rust: Line {}: '{}'", line_num + 1, line);
        
        // Check if this is a field header
        if let Some((field_name, immediate_value)) = parse_field_header(line) {
            eprintln!("🏷️ Rust: Found field header: '{}' with immediate value: '{}'", field_name, immediate_value);
            
            // Save previous field if we have one
            if let (Some(ref mut problem), Some(ref field)) = (&mut current_problem, &current_field) {
                eprintln!("💾 Rust: Saving previous field '{}' with value: '{}'", field, current_value.trim());
                set_problem_field(problem, field, &current_value.trim())?;
            }
            
            // Start new problem if this is the title field
            if field_name == "title" {
                if let Some(problem) = current_problem.take() {
                    eprintln!("✅ Rust: Completed problem: '{}'", problem.title);
                    problems.push(problem);
                }
                eprintln!("🆕 Rust: Starting new problem");
                current_problem = Some(ParsedProblem::new());
            }
            
            current_field = Some(field_name.clone());
            
            // Handle immediate value or start fresh for multi-line content
            if !immediate_value.is_empty() {
                eprintln!("📝 Rust: Using immediate value for field '{}': '{}'", field_name, immediate_value);
                current_value = immediate_value;
            } else {
                eprintln!("📝 Rust: Starting multi-line content for field '{}'", field_name);
                current_value.clear();
            }
        } else {
            eprintln!("📝 Rust: Content line for field '{:?}': '{}'", current_field, line);
            // This is content for the current field
            if !current_value.is_empty() {
                current_value.push('\n');
            }
            current_value.push_str(line);
        }
    }
    
    // Save the last field and problem
    if let (Some(ref mut problem), Some(ref field)) = (&mut current_problem, &current_field) {
        eprintln!("💾 Rust: Saving final field '{}' with value: '{}'", field, current_value.trim());
        set_problem_field(problem, field, &current_value.trim())?;
    }
    if let Some(problem) = current_problem {
        eprintln!("✅ Rust: Completed final problem: '{}'", problem.title);
        problems.push(problem);
    }
    
    eprintln!("📋 Rust: Finished parsing, found {} problems total", problems.len());
    
    // Validate all problems
    for (index, problem) in problems.iter().enumerate() {
        eprintln!("🔍 Rust: Validating problem {}: '{}'", index + 1, problem.title);
        if let Err(e) = validate_problem(problem) {
            eprintln!("❌ Rust: Problem {} validation failed: {}", index + 1, e);
            return Err(format!("Problem {} validation failed: {}", index + 1, e));
        }
        eprintln!("✅ Rust: Problem {} validation passed", index + 1);
    }
    
    Ok(problems)
}

// Helper function to parse field headers - now supports both "field:" and "field: value" formats
fn parse_field_header(line: &str) -> Option<(String, String)> {
    if line.trim_start_matches('#').trim().contains(':') {
        // Split on the first colon
        let cleaned_line = line.trim_start_matches('#').trim();
        if let Some(colon_pos) = cleaned_line.find(':') {
            let field_part = &cleaned_line[..colon_pos];
            let value_part = &cleaned_line[colon_pos + 1..];
            
            let field = field_part.trim().to_lowercase();
            let value = value_part.trim().to_string();
            
            
            // Check for dynamic example fields (e.g., "example 1", "example 2", etc.)
            let (normalized_field, is_example) = if field.starts_with("example") {
                ("description".to_string(), true)
            } else if field == "leetcode url" {
                ("leetcode_url".to_string(), false)
            } else {
                (field.clone(), false)
            };
            
            match normalized_field.as_str() {
                "title" | "description" | "difficulty" | "topics" | "leetcode_url" | 
                "constraints" | "hints" | "tags" => {
                    // Format example with header for better readability
                    let formatted_value = if is_example {
                        format!("{}:\n{}", field_part.trim(), value)
                    } else {
                        value
                    };
                    Some((normalized_field, formatted_value))
                },
                _ => {
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    }
}

// Helper function to set problem field
fn set_problem_field(problem: &mut ParsedProblem, field: &str, value: &str) -> Result<(), String> {
    match field {
        "title" => {
            if value.is_empty() {
                return Err("Title cannot be empty".to_string());
            }
            problem.title = value.to_string();
        },
        "description" => {
            if value.is_empty() && problem.description.is_empty() {
                return Err("Description cannot be empty".to_string());
            }
            // Append to description if it already has content (for examples)
            if !problem.description.is_empty() && !value.is_empty() {
                problem.description.push_str("\n\n");
                problem.description.push_str(value);
            } else if !value.is_empty() {
                problem.description = value.to_string();
            }
        },
        "difficulty" => {
            let difficulty = value.to_string();
            if !["Easy", "Medium", "Hard"].contains(&difficulty.as_str()) {
                return Err(format!("Invalid difficulty: {}. Must be Easy, Medium, or Hard", difficulty));
            }
            problem.difficulty = difficulty;
        },
        "topics" => {
            problem.topics = parse_list_field(value);
        },
        "leetcode_url" => {
            if !value.is_empty() {
                problem.leetcode_url = Some(value.to_string());
            }
        },
        "constraints" => {
            problem.constraints = parse_list_field(value);
        },
        "hints" => {
            problem.hints = parse_list_field(value);
        },
        "tags" => {
            // Handle tags as additional topics for now
            problem.topics.extend(parse_list_field(value));
        },
        _ => return Err(format!("Unknown field: {}", field)),
    }
    Ok(())
}

// Helper function to parse list fields (comma-separated or line-separated)
fn parse_list_field(value: &str) -> Vec<String> {
    // Smart detection: check if it looks like bullet points vs comma-separated
    let has_bullet_indicators = value.lines().any(|line| {
        let trimmed = line.trim();
        // Check for dash bullets or numbered items
        let dash_chars = ['-', '–', '—', '−', '∙', '•', '◦', '▪', '▫', '*'];
        for &dash in &dash_chars {
            if trimmed.starts_with(&format!("{} ", dash)) || 
               (trimmed.starts_with(dash) && trimmed.len() > 1) {
                return true;
            }
        }
        // Check for numbered items like "1. ", "2. "
        if let Some(pos) = trimmed.find('.') {
            if pos > 0 && trimmed[..pos].chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
        false
    });
    
    if has_bullet_indicators {
        parse_bullet_list(value)
    } else if value.contains(',') && !value.contains('\n') {
        // Only treat as comma-separated if it's single-line AND contains commas
        value.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        parse_bullet_list(value)
    }
}

// Helper function to parse bullet list with proper dash removal
fn parse_bullet_list(value: &str) -> Vec<String> {
    let dash_chars = ['-', '–', '—', '−', '∙', '•', '◦', '▪', '▫', '*'];
    let lines: Vec<&str> = value.lines().collect();
    let mut items = Vec::new();
    
    
    for (i, line) in lines.iter().enumerate() {
        let trimmed = normalize_whitespace(line);
        
        
        if trimmed.is_empty() {
            continue;
        }
        
        // Check for bullet points
        let mut found_bullet = false;
        for &dash in &dash_chars {
            let dash_with_space = format!("{} ", dash);
            if trimmed.starts_with(&dash_with_space) {
                let content = trimmed[2..].trim().to_string();
                if !content.is_empty() {
                    items.push(content);
                }
                found_bullet = true;
                break;
            } else if trimmed.starts_with(dash) && trimmed.len() > 1 {
                let content = trimmed[1..].trim().to_string();
                if !content.is_empty() {
                    items.push(content);
                }
                found_bullet = true;
                break;
            }
        }
        
        // Check for numbered items
        if !found_bullet && is_numbered_item(&trimmed) {
            let content = remove_number_prefix(&trimmed);
            if !content.is_empty() {
                items.push(content);
            }
            found_bullet = true;
        }
        
        // If no bullet found and this is the first item, or if it looks like a continuation
        if !found_bullet {
            if items.is_empty() {
                // First line without bullet, treat as first item
                items.push(trimmed);
            } else if should_treat_as_continuation(&trimmed, line) {
                // Append to last item
                if let Some(last) = items.last_mut() {
                    last.push(' ');
                    last.push_str(&trimmed);
                }
            } else {
                // Treat as separate item
                items.push(trimmed);
            }
        }
    }
    
    // Filter out empty items, items that are too long, and dash-only entries
    let result = items.into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| {
            !item.is_empty() && 
            item.len() <= 500 &&
            !is_dash_only(item)
        })
        .collect::<Vec<String>>();
        
    result
}

// Helper function to normalize whitespace
fn normalize_whitespace(text: &str) -> String {
    // Replace non-breaking spaces and normalize whitespace
    text.chars()
        .map(|c| match c {
            '\u{00A0}' | '\u{2007}' | '\u{202F}' => ' ', // Non-breaking spaces
            c => c,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

// Helper function to check if line is a numbered item
fn is_numbered_item(text: &str) -> bool {
    if let Some(pos) = text.find('.') {
        if pos > 0 {
            let number_part = &text[..pos];
            return number_part.chars().all(|c| c.is_ascii_digit()) && text.len() > pos + 1;
        }
    }
    false
}

// Helper function to remove number prefix from numbered item
fn remove_number_prefix(text: &str) -> String {
    if let Some(pos) = text.find('.') {
        if pos > 0 && pos + 1 < text.len() {
            return text[pos + 1..].trim().to_string();
        }
    }
    text.to_string()
}

// Helper function to determine if a line should be treated as continuation
fn should_treat_as_continuation(trimmed: &str, original_line: &str) -> bool {
    // Don't treat as continuation if line looks like it could be a bullet point that we failed to detect
    if trimmed.len() > 50 && trimmed.contains(' ') && trimmed.chars().next().map_or(false, |c| c.is_ascii_alphabetic()) {
        return false;
    }
    
    // Don't treat as continuation if the original line had significant leading whitespace
    let leading_whitespace = original_line.len() - original_line.trim_start().len();
    if leading_whitespace > 2 {
        return false;
    }
    
    // Don't treat as continuation if line starts with common sentence starters
    let sentence_starters = ["The", "This", "When", "If", "Use", "Keep", "Remember", "Consider", "Try", "Again", "Also", "Another"];
    for starter in &sentence_starters {
        if trimmed.starts_with(&format!("{} ", starter)) {
            return false;
        }
    }
    
    true
}

// Helper function to check if a string contains only dashes
fn is_dash_only(text: &str) -> bool {
    let dash_chars = ['-', '–', '—', '−'];
    !text.is_empty() && text.chars().all(|c| dash_chars.contains(&c) || c.is_whitespace())
}

// Helper function to validate a parsed problem
fn validate_problem(problem: &ParsedProblem) -> Result<(), String> {
    if problem.title.is_empty() {
        return Err("Title is required".to_string());
    }
    if problem.description.is_empty() {
        return Err("Description is required".to_string());
    }
    if problem.difficulty.is_empty() {
        return Err("Difficulty is required".to_string());
    }
    if !["Easy", "Medium", "Hard"].contains(&problem.difficulty.as_str()) {
        return Err(format!("Invalid difficulty: {}", problem.difficulty));
    }
    Ok(())
}