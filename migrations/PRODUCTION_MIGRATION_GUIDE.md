# Production Database Migration Guide

**Migration Date**: August 27, 2025  
**Migration Version**: 1.1.0  
**Target**: Production Database Schema Update  
**Purpose**: Fix "no such column: is_solution" error

## 🚨 Critical Issue

The production database is missing the `is_solution` column that was added in development. This causes the application to crash with:

```
Error loading problem: Failed to check for solution card: no such column: is_solution in SELECT id, problem_id, card_number, code, language, notes, status, total_duration, created_at, last_modified, is_solution FROM cards WHERE problem_id = ? AND is_solution = 1 LIMIT 1
```

## 📊 Schema Comparison

| Database | has `is_solution` | Status |
|----------|-------------------|---------|
| Development | ✅ Yes | Working |
| Production | ❌ No | **Broken** |

## 🛠️ Migration Process

### Step 1: Create Backup

```bash
# Create timestamped backup
sqlite3 /path/to/production/database.db ".backup production_backup_$(date +%Y%m%d_%H%M%S).db"

# Verify backup integrity
sqlite3 production_backup_YYYYMMDD_HHMMSS.db "PRAGMA integrity_check; SELECT COUNT(*) FROM cards;"
```

### Step 2: Apply Migration

```bash
# Apply the migration
sqlite3 /path/to/production/database.db < migrations/production-migration.sql
```

### Step 3: Verify Migration

```bash
# Run verification script
sqlite3 /path/to/production/database.db < migrations/verify-production-schema.sql
```

## 📋 Migration Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `production-migration.sql` | Main migration script | **Run this first** |
| `verify-production-schema.sql` | Verification queries | Run after migration |
| `rollback-migration.sql` | Emergency rollback | Only if migration fails |
| `PRODUCTION_MIGRATION_GUIDE.md` | This documentation | Reference guide |

## ⚡ Quick Migration Commands

### Full Migration Process
```bash
# 1. Navigate to project directory
cd "/Users/mahmutsalman/Documents/MyCodingProjects/Projects/Efficinecy apps/LearningApps/DSALearningApp"

# 2. Create backup (REQUIRED)
sqlite3 "src-tauri/dev-data/database.db" ".backup migrations/production_backup_$(date +%Y%m%d_%H%M%S).db"

# 3. Apply migration
sqlite3 "src-tauri/dev-data/database.db" < migrations/production-migration.sql

# 4. Verify migration
sqlite3 "src-tauri/dev-data/database.db" < migrations/verify-production-schema.sql

# 5. Test application
npm run tauri dev
```

### Manual Verification Commands
```sql
-- Check column exists
PRAGMA table_info(cards);

-- Check index exists  
PRAGMA index_list(cards);

-- Check data integrity
SELECT COUNT(*) as total, 
       SUM(CASE WHEN is_solution = 1 THEN 1 ELSE 0 END) as solutions
FROM cards;
```

## 🎯 Expected Results

After successful migration:

1. **Table Structure**: `cards` table has 12 columns (including `is_solution`)
2. **Index Created**: `idx_cards_solution` exists
3. **Data Integrity**: All existing cards have `is_solution = 0` 
4. **Application Works**: No more "no such column" errors
5. **Solution Cards**: Can be created via shift+click

## ✅ Success Criteria Checklist

- [ ] Backup created and verified
- [ ] Migration script executed without errors
- [ ] `is_solution` column present in table schema
- [ ] `idx_cards_solution` index created
- [ ] All existing cards have `is_solution = 0`
- [ ] CHECK constraint working (only 0 or 1 values allowed)
- [ ] Application starts without database errors
- [ ] Solution card creation works (shift+click)
- [ ] No data loss occurred

## 🚨 Troubleshooting

### Migration Fails
1. Check SQLite version: `sqlite3 --version`
2. Verify database permissions
3. Ensure no active connections to database
4. Check available disk space

### Application Still Crashes  
1. Verify column exists: `PRAGMA table_info(cards)`
2. Check for case sensitivity issues
3. Restart application completely
4. Clear any cached data

### Data Issues
1. Run integrity check: `PRAGMA integrity_check`
2. Verify foreign key constraints: `PRAGMA foreign_key_check`
3. Check for orphaned records

## 🔄 Rollback Procedure

If migration causes issues:

```bash
# Option 1: Restore from backup
cp migrations/production_backup_YYYYMMDD_HHMMSS.db src-tauri/dev-data/database.db

# Option 2: Use rollback script (data loss warning!)
sqlite3 src-tauri/dev-data/database.db < migrations/rollback-migration.sql
```

## 📝 Migration Log

Record your migration results:

```
Migration Date: _______________
Migration Time: _______________
Backup Location: _______________
Migration Result: ✅ Success / ❌ Failed
Issues Encountered: _______________
Resolution Steps: _______________
Final Status: _______________
```

## 🔍 Post-Migration Testing

1. **Start Application**: `npm run tauri dev`
2. **Navigate to Problem**: Select any problem card
3. **Test Regular Navigation**: Click right arrow (should work)
4. **Test Solution Toggle**: Shift+click right arrow (should create solution card)
5. **Verify Solution Card**: Check if different content loads
6. **Test Solution Exit**: Shift+click again (should return to regular card)

## 🛡️ Prevention for Future

To prevent schema drift between development and production:

1. **Version Control**: All schema changes in migrations folder
2. **Documentation**: Update migration docs for each change
3. **Testing**: Test migrations on copy of production data
4. **Automation**: Consider migration automation scripts
5. **Monitoring**: Add health checks for schema consistency

## 📞 Support

If you encounter issues during migration:

1. **Check the backup** is intact and restorable
2. **Review the error logs** for specific error messages  
3. **Test the rollback procedure** on a copy first
4. **Document any issues** for future reference

---

**⚠️ Important**: Always create a backup before running any database migration!

**🎯 Goal**: Restore application functionality by adding the missing `is_solution` column to match the development database schema.