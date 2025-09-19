process.env.HOSTNAME = 'authz.local';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

import * as authz from '../../../src/authz/authz-adapter';
import { canViewMaster, canModerate, canCensor, canDelete, canUpdateOthers } from '../../../src/domain/policy';

beforeAll(() => {
    jest.spyOn(authz, 'hasPermission').mockImplementation(async (_userId: string, perm: string) => perm === 'media:moderate' || perm === 'media:censor');
});

describe('policy permission helpers', () => {
    test('canViewMaster returns true for public approved when anonymous', async () => {
        expect(await canViewMaster(undefined, 'owner', 'approved', 'public')).toBe(true);
    });

    test('canViewMaster denies anonymous for non-approved', async () => {
        expect(await canViewMaster(undefined, 'owner', 'rejected', 'public')).toBe(false);
    });

    test('canModerate true when hasPermission resolves true', async () => {
        expect(await canModerate('u1')).toBe(true);
    });

    test('canCensor true when hasPermission resolves true', async () => {
        expect(await canCensor('u1')).toBe(true);
    });

    test('canDelete false when permission not granted', async () => {
        expect(await canDelete('u1')).toBe(false);
    });

    test('canUpdateOthers false when permission not granted', async () => {
        expect(await canUpdateOthers('u1')).toBe(false);
    });
});
