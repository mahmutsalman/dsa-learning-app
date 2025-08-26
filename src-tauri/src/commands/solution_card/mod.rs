// Solution Card Module
// 
// This module provides commands for managing solution cards - special cards
// that contain the solution to a problem. Solution cards are distinguished
// from regular cards by the is_solution flag and don't count in normal
// card navigation.

pub mod queries;
pub mod handlers;

// Re-export the command handlers for use in main.rs
pub use handlers::*;