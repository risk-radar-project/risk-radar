-- Create roles table
CREATE TABLE
    IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP
        WITH
            TIME ZONE DEFAULT NOW (),
            updated_at TIMESTAMP
        WITH
            TIME ZONE DEFAULT NOW ()
    );

-- Create permissions table (global catalog)
CREATE TABLE
    IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        name VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "users:ban", "reports:read"
        description TEXT,
        resource VARCHAR(50) NOT NULL,      -- e.g., "users", "reports", "system"
        action VARCHAR(50) NOT NULL,        -- e.g., "read", "create", "update", "delete", "ban"
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(resource, action)
    );

-- Create role_permissions junction table
CREATE TABLE
    IF NOT EXISTS role_permissions (
        role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (role_id, permission_id)
    );

-- Create user_roles table
CREATE TABLE
    IF NOT EXISTS user_roles (
        user_id UUID NOT NULL,
        role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
        assigned_at TIMESTAMP
        WITH
            TIME ZONE DEFAULT NOW (),
            PRIMARY KEY (user_id, role_id)
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions (resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions (action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- Seed default roles if they don't exist
INSERT INTO
    roles (name, description)
VALUES
    (
        'user',
        'Basic user role - can create and manage own reports'
    ) ON CONFLICT (name) DO NOTHING;

INSERT INTO
    roles (name, description)
VALUES
    (
        'volunteer',
        'Community volunteer - can moderate reports socially'
    ) ON CONFLICT (name) DO NOTHING;

INSERT INTO
    roles (name, description)
VALUES
    (
        'moderator',
        'Content moderator with administrative tools access'
    ) ON CONFLICT (name) DO NOTHING;

INSERT INTO
    roles (name, description)
VALUES
    (
        'admin',
        'Administrator role with full system access'
    ) ON CONFLICT (name) DO NOTHING;

-- Seed default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
-- Report permissions
('reports:create', 'Create new reports', 'reports', 'create'),
('reports:read', 'Read access to reports and map', 'reports', 'read'),
('reports:cancel', 'Cancel own reports', 'reports', 'cancel'),
('reports:cancel-any', 'Cancel any reports (community moderation)', 'reports', 'cancel-any'),
('reports:edit', 'Edit existing reports', 'reports', 'edit'),
('reports:delete', 'Delete reports', 'reports', 'delete'),
('reports:categorize', 'Assign categories to reports (with AI help)', 'reports', 'categorize'),
('reports:rate-severity', 'Set threat level for reports', 'reports', 'rate-severity'),
('reports:validate', 'Report corrections/issues with reports', 'reports', 'validate'),
('reports:view-location', 'Open reports on map', 'reports', 'view-location'),

-- User permissions
('users:profile', 'View and edit own profile', 'users', 'profile'),
('users:history', 'View own reports history', 'users', 'history'),
('users:delete-account', 'Delete own account', 'users', 'delete-account'),
('users:view', 'View user profiles', 'users', 'view'),
('users:ban', 'Ban users from the system', 'users', 'ban'),
('users:unban', 'Unban users', 'users', 'unban'),

-- AI permissions
('ai:chat', 'Chat with AI in context of reports', 'ai', 'chat'),
('ai:summary', 'Get AI summary of area/region', 'ai', 'summary'),

-- Statistics permissions
('stats:view', 'Access to dashboards and statistics', 'stats', 'view'),

-- Audit permissions
('audit:view', 'View audit logs', 'audit', 'view'),

-- Media permissions
('media:read-all', 'Read access to all media items', 'media', 'read-all'),
('media:moderate', 'Moderate media content', 'media', 'moderate'),
('media:censor', 'Censor or blur sensitive media', 'media', 'censor'),
('media:delete', 'Delete media content', 'media', 'delete'),
('media:update', 'Update media metadata or status', 'media', 'update'),

-- Role permissions  
('roles:assign', 'Assign roles to users', 'roles', 'assign'),
('roles:edit', 'Modify roles and permissions', 'roles', 'edit'),

-- System permissions
('system:admin', 'Highest level system administration', 'system', 'admin'),

-- Wildcard permissions for granular access control
('reports:*', 'Full access to all report operations', 'reports', '*'),
('users:*', 'Full access to all user operations', 'users', '*'),
('stats:*', 'Full access to all statistics operations', 'stats', '*'),
('media:*', 'Full access to all media operations', 'media', '*'),
('audit:*', 'Full access to all audit operations', 'audit', '*'),
('*:*', 'Full access to everything (super admin)', '*', '*')

ON CONFLICT (resource, action) DO NOTHING;

-- Setup default role-permission assignments
DO $$
DECLARE
    admin_role_id UUID;
    moderator_role_id UUID;
    volunteer_role_id UUID;
    user_role_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    SELECT id INTO moderator_role_id FROM roles WHERE name = 'moderator';
    SELECT id INTO volunteer_role_id FROM roles WHERE name = 'volunteer';
    SELECT id INTO user_role_id FROM roles WHERE name = 'user';

    -- Admin gets super admin permission (covers everything)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions 
    WHERE name = '*:*'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Moderator gets all permissions from volunteer plus additional admin tools
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT moderator_role_id, id FROM permissions 
    WHERE name IN (
        -- User permissions (inherited)
        'reports:create', 'reports:read', 'reports:cancel', 'reports:view-location', 
        'reports:categorize', 'reports:rate-severity', 'users:profile', 'users:history', 
        'users:delete-account', 'ai:chat', 'ai:summary',
        -- Volunteer permissions (inherited)
        'reports:cancel-any', 'reports:validate',
        -- Moderator specific permissions
        'reports:edit', 'reports:delete', 'users:ban', 'users:unban', 'users:view',
        'stats:view', 'audit:view',
        -- Media permissions
        'media:read-all', 'media:moderate', 'media:censor', 'media:delete', 'media:update'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Volunteer gets all user permissions plus community moderation
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT volunteer_role_id, id FROM permissions 
    WHERE name IN (
        -- User permissions (inherited)
        'reports:create', 'reports:read', 'reports:cancel', 'reports:view-location',
        'reports:categorize', 'reports:rate-severity', 'users:profile', 'users:history',
        'users:delete-account', 'ai:chat', 'ai:summary',
        -- Volunteer specific permissions
        'reports:cancel-any', 'reports:validate', 'reports:edit'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- User gets basic permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT user_role_id, id FROM permissions 
    WHERE name IN (
        'reports:create', 'reports:read', 'reports:cancel', 'reports:view-location',
        'reports:categorize', 'reports:rate-severity', 'users:profile', 'users:history',
        'users:delete-account', 'ai:chat', 'ai:summary'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- Seed superadmin user into user_roles
-- Note: authz-service does not own the 'users' table, so we only seed the role assignment.
-- The user with this ID must be created in user-service.
DO $$
DECLARE
    admin_role_id UUID;
    -- Superadmin UUID - has full permissions
    superadmin_user_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';

    -- Assign admin role to superadmin
    INSERT INTO user_roles (user_id, role_id)
    VALUES (superadmin_user_id, admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;