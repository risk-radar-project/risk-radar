-- Repair permissions and ensure Admin has access
-- This migration re-inserts permissions that might be missing and ensures Admin has explicit access

-- 1. Ensure all critical permissions exist
INSERT INTO permissions (name, description, resource, action) VALUES
-- User permissions
('users:view', 'View user profiles', 'users', 'view'),
('users:ban', 'Ban users from the system', 'users', 'ban'),
('users:unban', 'Unban users', 'users', 'unban'),
('users:profile', 'View and edit own profile', 'users', 'profile'),
-- Report permissions
('reports:read', 'Read access to reports and map', 'reports', 'read'),
('reports:create', 'Create new reports', 'reports', 'create'),
('reports:edit', 'Edit existing reports', 'reports', 'edit'),
('reports:delete', 'Delete reports', 'reports', 'delete'),
-- Role permissions
('roles:read', 'View roles and permissions', 'roles', 'read'),
('roles:assign', 'Assign roles to users', 'roles', 'assign'),
('roles:edit', 'Modify roles and permissions', 'roles', 'edit'),
-- Stats permission
('stats:view', 'Access to dashboards and statistics', 'stats', 'view'),
-- Audit permission
('audit:view', 'View audit logs', 'audit', 'view')
ON CONFLICT (resource, action) DO UPDATE 
SET description = EXCLUDED.description; -- Update description if it was missing/changed

-- 2. Ensure Admin role has explicit permissions (even if they have wildcard, this helps UI/Debugging)
DO $$
DECLARE
    admin_role_id UUID;
    perm RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';

    IF admin_role_id IS NOT NULL THEN
        -- Loop through all permissions and assign to admin
        FOR perm IN SELECT id FROM permissions LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;
