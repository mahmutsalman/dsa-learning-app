// Solution Card Database Queries
//
// Isolated database operations for solution card management.
// All SQL logic is contained here to maintain separation of concerns.

use rusqlite::{Connection, Row, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct SolutionCard {
    pub id: String,
    pub problem_id: String,
    pub card_number: i32,
    pub code: String,
    pub language: String,
    pub notes: String,
    pub status: String,
    pub total_duration: i32,
    pub created_at: String,
    pub last_modified: String,
    pub is_solution: bool,
}

impl SolutionCard {
    fn from_row(row: &Row) -> SqliteResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            problem_id: row.get("problem_id")?,
            card_number: row.get("card_number")?,
            code: row.get("code")?,
            language: row.get("language")?,
            notes: row.get("notes")?,
            status: row.get("status")?,
            total_duration: row.get("total_duration")?,
            created_at: row.get("created_at")?,
            last_modified: row.get("last_modified")?,
            is_solution: row.get::<_, i32>("is_solution")? == 1,
        })
    }
}

/// Get the solution card for a specific problem
pub fn get_solution_card(conn: &Connection, problem_id: &str) -> SqliteResult<Option<SolutionCard>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, card_number, code, language, notes, status, 
                total_duration, created_at, last_modified, is_solution
         FROM cards 
         WHERE problem_id = ? AND is_solution = 1
         LIMIT 1"
    )?;

    let card_iter = stmt.query_map(params![problem_id], |row| {
        SolutionCard::from_row(row)
    })?;

    for card_result in card_iter {
        return Ok(Some(card_result?));
    }

    Ok(None)
}

/// Create a new solution card for a problem
pub fn create_solution_card(conn: &Connection, problem_id: &str) -> SqliteResult<SolutionCard> {
    let card_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Insert the solution card
    conn.execute(
        "INSERT INTO cards (
            id, problem_id, card_number, code, language, notes, status,
            total_duration, created_at, last_modified, is_solution
         ) VALUES (?, ?, 0, '', 'java', '', 'In Progress', 0, ?, ?, 1)",
        params![card_id, problem_id, now, now]
    )?;

    // Return the created card
    Ok(SolutionCard {
        id: card_id,
        problem_id: problem_id.to_string(),
        card_number: 0, // Solution cards have card_number 0
        code: String::new(),
        language: "java".to_string(),
        notes: String::new(),
        status: "In Progress".to_string(),
        total_duration: 0,
        created_at: now.clone(),
        last_modified: now,
        is_solution: true,
    })
}

/// Update solution card code
pub fn update_solution_card_code(conn: &Connection, card_id: &str, code: &str, language: &str) -> SqliteResult<()> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE cards 
         SET code = ?, language = ?, last_modified = ?
         WHERE id = ? AND is_solution = 1",
        params![code, language, now, card_id]
    )?;

    Ok(())
}

/// Update solution card notes
pub fn update_solution_card_notes(conn: &Connection, card_id: &str, notes: &str) -> SqliteResult<()> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE cards 
         SET notes = ?, last_modified = ?
         WHERE id = ? AND is_solution = 1",
        params![notes, now, card_id]
    )?;

    Ok(())
}

/// Check if a solution card exists for a problem
pub fn solution_card_exists(conn: &Connection, problem_id: &str) -> SqliteResult<bool> {
    let mut stmt = conn.prepare(
        "SELECT COUNT(*) as count FROM cards WHERE problem_id = ? AND is_solution = 1"
    )?;

    let count: i32 = stmt.query_row(params![problem_id], |row| {
        row.get("count")
    })?;

    Ok(count > 0)
}

/// Delete solution card (if needed for testing or cleanup)
pub fn delete_solution_card(conn: &Connection, problem_id: &str) -> SqliteResult<bool> {
    let rows_affected = conn.execute(
        "DELETE FROM cards WHERE problem_id = ? AND is_solution = 1",
        params![problem_id]
    )?;

    Ok(rows_affected > 0)
}

/// Get regular (non-solution) cards for a problem
/// This is useful for the normal card navigation to exclude solution cards
pub fn get_regular_cards(conn: &Connection, problem_id: &str) -> SqliteResult<Vec<SolutionCard>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, card_number, code, language, notes, status, 
                total_duration, created_at, last_modified, is_solution
         FROM cards 
         WHERE problem_id = ? AND (is_solution IS NULL OR is_solution = 0)
         ORDER BY card_number ASC"
    )?;

    let card_iter = stmt.query_map(params![problem_id], |row| {
        SolutionCard::from_row(row)
    })?;

    let mut cards = Vec::new();
    for card_result in card_iter {
        cards.push(card_result?);
    }

    Ok(cards)
}
