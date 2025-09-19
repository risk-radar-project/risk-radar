export async function hasPermission(_userId, perm) {
    return perm === "media:moderate" || perm === "media:censor"
}
