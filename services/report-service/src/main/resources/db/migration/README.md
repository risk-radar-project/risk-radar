# Database Migrations

This directory contains SQL migration scripts for the report-service database.

## Manual Migration Execution

Since we're using Hibernate `ddl-auto: update`, migrations need to be run manually when needed.

### How to apply migrations:

```bash
# From project root directory
docker-compose exec -T postgres psql -U risk-radar-admin -d risk-radar -f /path/to/migration.sql
```

Or connect to the database directly:
```bash
docker-compose exec -it postgres psql -U risk-radar-admin -d risk-radar
```

## Migrations

### V001__extend_report_fields.sql
- **Date**: 2026-01-06
- **Description**: Extends report field limits
  - `title`: VARCHAR(255) → VARCHAR(500)
  - `description`: VARCHAR(255) → TEXT (unlimited)
- **Status**: ✅ Applied manually on 2026-01-06

## Notes

- Hibernate `ddl-auto: update` doesn't always handle column type changes correctly
- Manual migrations may be required for schema modifications
- Always backup data before running migrations in production
