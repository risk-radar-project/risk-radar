-- Revoke roles:assign from moderator
WITH moderator AS (
    SELECT id AS role_id FROM roles WHERE name = 'moderator'
), perm AS (
    SELECT id AS permission_id FROM permissions WHERE name = 'roles:assign'
)
DELETE FROM role_permissions rp
USING moderator, perm
WHERE rp.role_id = moderator.role_id
  AND rp.permission_id = perm.permission_id;
