import { useQuery } from "@tanstack/react-query"
import { getRoles, getPermissions } from "@/lib/api/authz"

export function useRoles() {
    return useQuery({
        queryKey: ["roles"],
        queryFn: getRoles
    })
}

export function usePermissions() {
    return useQuery({
        queryKey: ["permissions"],
        queryFn: getPermissions
    })
}
