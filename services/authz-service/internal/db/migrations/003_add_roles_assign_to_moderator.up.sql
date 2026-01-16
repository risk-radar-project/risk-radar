-- Grant roles:assign to moderator
WITH moderator AS (
    SELECT id AS role_id FROM roles WHERE name = 'moderator'
), perm AS (
    SELECT id AS permission_id FROM permissions WHERE name = 'roles:assign'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT moderator.role_id, perm.permission_id FROM moderator, perm
ON CONFLICT (role_id, permission_id) DO NOTHING;
