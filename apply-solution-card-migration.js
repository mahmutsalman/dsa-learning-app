#!/usr/bin/env node

/**
 * Solution Card Migration Script
 * 
 * Applies the solution card database migration to add is_solution column to cards table
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const DATABASE_PATH = path.join(PROJECT_ROOT, 'src-tauri/dev-data/database.db');
const MIGRATION_FILE = path.join(PROJECT_ROOT, 'migrations/add_solution_card_support.sql');
const BACKUP_DB = path.join(PROJECT_ROOT, 'src-tauri/dev-data/database_backup_solution_migration_' + Date.now() + '.db');

console.log('🔄 Solution Card Feature Migration');
console.log('===================================');
console.log(`Database: ${DATABASE_PATH}`);
console.log(`Migration: ${MIGRATION_FILE}`);
console.log(`Backup: ${BACKUP_DB}`);
console.log('');

function runSQLCommand(dbPath, command, description) {
    console.log(`📝 ${description}`);
    try {
        const result = execSync(`sqlite3 "${dbPath}" "${command}"`, { encoding: 'utf8' });
        return result.trim();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        throw error;
    }
}

function checkFileExists(filePath) {
    return fs.existsSync(filePath);
}

async function main() {
    try {
        // 1. Verify database exists
        if (!checkFileExists(DATABASE_PATH)) {
            throw new Error(`Database not found: ${DATABASE_PATH}`);
        }

        // 2. Verify migration file exists
        if (!checkFileExists(MIGRATION_FILE)) {
            throw new Error(`Migration file not found: ${MIGRATION_FILE}`);
        }

        console.log('✅ Database and migration file found');

        // 3. Check if migration already applied
        console.log('\n🔍 Checking if migration already applied...');
        try {
            const columnExists = runSQLCommand(DATABASE_PATH, "PRAGMA table_info(cards);", 'Checking table structure');
            if (columnExists.includes('is_solution')) {
                console.log('⚠️  Migration appears to already be applied. is_solution column exists.');
                const response = require('readline-sync').question('Continue anyway? (y/N): ');
                if (response.toLowerCase() !== 'y') {
                    console.log('❌ Migration cancelled');
                    return;
                }
            }
        } catch (error) {
            console.log('Could not check existing schema, proceeding with migration...');
        }

        // 4. Create backup
        console.log('\n📦 Creating backup of database...');
        fs.copyFileSync(DATABASE_PATH, BACKUP_DB);
        console.log(`✅ Backup created: ${BACKUP_DB}`);

        // 5. Apply migration
        console.log('\n🚀 Applying solution card migration...');
        const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
        
        // Remove comments and split into statements
        const statements = migrationSQL
            .split('\n')
            .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
            .join('\n')
            .split(';')
            .filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            if (statement.trim()) {
                runSQLCommand(DATABASE_PATH, statement.trim() + ';', `Executing: ${statement.trim().substring(0, 50)}...`);
            }
        }

        // 6. Verify migration
        console.log('\n✅ Verifying migration...');
        const tableInfo = runSQLCommand(DATABASE_PATH, "PRAGMA table_info(cards);", 'Checking table structure');
        const indexInfo = runSQLCommand(DATABASE_PATH, "PRAGMA index_list(cards);", 'Checking indexes');
        
        if (tableInfo.includes('is_solution')) {
            console.log('✅ is_solution column added successfully');
        } else {
            throw new Error('❌ is_solution column was not added');
        }

        if (indexInfo.includes('idx_cards_solution')) {
            console.log('✅ Solution card index created successfully');
        } else {
            throw new Error('❌ Solution card index was not created');
        }

        // 7. Test the constraint
        console.log('\n🧪 Testing column constraints...');
        try {
            runSQLCommand(DATABASE_PATH, "INSERT INTO cards (id, problem_id, card_number, is_solution) VALUES ('test_constraint', 'test_prob', 1, 2);", 'Testing invalid constraint value');
            console.log('❌ Constraint test failed - invalid value was accepted');
        } catch (error) {
            console.log('✅ Constraint working correctly - invalid values rejected');
        }

        // Clean up test data if it exists
        try {
            runSQLCommand(DATABASE_PATH, "DELETE FROM cards WHERE id = 'test_constraint';", 'Cleaning up test data');
        } catch (error) {
            // Ignore cleanup errors
        }

        console.log('\n🎉 Solution card migration completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Test the application to ensure everything works');
        console.log('2. Implement the solution card feature components');
        console.log('3. If there are issues, restore from backup:');
        console.log(`   cp "${BACKUP_DB}" "${DATABASE_PATH}"`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        
        if (checkFileExists(BACKUP_DB)) {
            console.log('\n🔄 Restoring backup...');
            fs.copyFileSync(BACKUP_DB, DATABASE_PATH);
            console.log('✅ Backup restored');
        }
        
        process.exit(1);
    }
}

// Check if readline-sync is available for interactive prompts
try {
    require('readline-sync');
} catch (e) {
    console.log('📦 Installing readline-sync for interactive prompts...');
    execSync('npm install readline-sync', { stdio: 'inherit' });
}

main();