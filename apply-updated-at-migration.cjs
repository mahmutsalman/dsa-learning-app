#!/usr/bin/env node

/**
 * Updated At Migration Script
 * 
 * Applies the database migration to add updated_at column to problems table
 * for comprehensive update tracking in the dashboard
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const DATABASE_PATH = path.join(PROJECT_ROOT, 'src-tauri/dev-data/database.db');
const MIGRATION_FILE = path.join(PROJECT_ROOT, 'migrations/add_updated_at_to_problems.sql');
const BACKUP_DB = path.join(PROJECT_ROOT, 'src-tauri/dev-data/database_backup_updated_at_migration_' + Date.now() + '.db');

console.log('🔄 Problems Updated At Migration');
console.log('=================================');
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
            const columnExists = runSQLCommand(DATABASE_PATH, "PRAGMA table_info(problems);", 'Checking problems table structure');
            if (columnExists.includes('updated_at')) {
                console.log('⚠️  Migration appears to already be applied. updated_at column exists.');
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
        console.log('\n🚀 Applying updated_at migration...');
        const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
        
        // Execute the entire migration as a single command to maintain transaction context
        console.log('📝 Executing migration as single transaction...');
        execSync(`sqlite3 "${DATABASE_PATH}" < "${MIGRATION_FILE}"`, { 
            stdio: 'pipe',
            encoding: 'utf8'
        });

        // 6. Verify migration
        console.log('\n✅ Verifying migration...');
        const tableInfo = runSQLCommand(DATABASE_PATH, "PRAGMA table_info(problems);", 'Checking problems table structure');
        const indexInfo = runSQLCommand(DATABASE_PATH, "PRAGMA index_list(problems);", 'Checking indexes');
        
        if (tableInfo.includes('updated_at')) {
            console.log('✅ updated_at column added successfully');
        } else {
            throw new Error('❌ updated_at column was not added');
        }

        if (indexInfo.includes('idx_problems_updated_at')) {
            console.log('✅ Updated_at index created successfully');
        } else {
            throw new Error('❌ Updated_at index was not created');
        }

        // 7. Verify data integrity
        console.log('\n🧪 Testing data integrity...');
        const dataCheck = runSQLCommand(DATABASE_PATH, "SELECT COUNT(*) as total, COUNT(updated_at) as with_updated_at FROM problems;", 'Checking updated_at data');
        console.log(`Data check result: ${dataCheck}`);

        if (dataCheck.includes('|')) {
            const [total, withUpdatedAt] = dataCheck.split('|');
            if (total === withUpdatedAt) {
                console.log('✅ All problems have updated_at values');
            } else {
                console.log('⚠️  Some problems missing updated_at values');
            }
        }

        // 8. Test a sample query
        console.log('\n🔍 Testing sample queries...');
        try {
            const sampleData = runSQLCommand(DATABASE_PATH, "SELECT id, title, created_at, updated_at FROM problems LIMIT 3;", 'Sample problems data');
            console.log('✅ Sample query successful');
            if (sampleData) {
                console.log('Sample data preview:', sampleData.split('\n').slice(0, 3).join('\n'));
            }
        } catch (error) {
            console.log('⚠️  Sample query failed, but migration may still be successful');
        }

        console.log('\n🎉 Updated_at migration completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Update the Rust models to include updated_at field');
        console.log('2. Modify update_problem function to set updated_at');
        console.log('3. Update Dashboard logic to consider problem updated_at');
        console.log('4. Test the application to ensure everything works');
        console.log('5. If there are issues, restore from backup:');
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