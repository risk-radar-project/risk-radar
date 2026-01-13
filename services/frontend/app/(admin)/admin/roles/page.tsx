"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Loader, EmptyState, ModalConfirm } from "@/components/ui/ux"
import { RolesTable } from "@/components/admin/roles/roles-table"
import { RoleDialog } from "@/components/admin/roles/role-dialog"
import { useRoles, usePermissions } from "@/hooks/use-authz"
import { Role, deleteRole } from "@/lib/api/authz"

export default function RolesPage() {
    const queryClient = useQueryClient()
    const { data: roles, isLoading: rolesLoading, error: rolesError } = useRoles()
    const { data: permissions, isLoading: permsLoading } = usePermissions()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined)
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)

    const deleteMutation = useMutation({
        mutationFn: (roleId: string) => deleteRole(roleId),
        onSuccess: () => {
            toast.success("Rola została usunięta")
            queryClient.invalidateQueries({ queryKey: ["roles"] })
            setRoleToDelete(null)
        },
        onError: (error: Error) => {
            toast.error(`Nie udało się usunąć roli: ${error.message}`)
        }
    })

    const handleCreate = () => {
        setSelectedRole(undefined)
        setIsDialogOpen(true)
    }

    const handleEdit = (role: Role) => {
        setSelectedRole(role)
        setIsDialogOpen(true)
    }

    const handleDeleteClick = (role: Role) => {
        setRoleToDelete(role)
    }

    const handleConfirmDelete = () => {
        if (roleToDelete) {
            deleteMutation.mutate(roleToDelete.id)
        }
    }

    if (rolesLoading || permsLoading) {
        return <Loader />
    }

    if (rolesError) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center text-center">
                <h3 className="mb-2 text-lg font-semibold text-red-500">Błąd ładowania danych</h3>
                <p className="text-zinc-400">{(rolesError as Error).message}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">
                    Spróbuj ponownie
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Role i Uprawnienia</h2>
                    <p className="text-zinc-400">Zarządzaj rolami użytkowników i ich dostępem do systemu.</p>
                </div>
                <Button onClick={handleCreate} className="bg-[#d97706] text-[#120c07] hover:bg-[#d97706]/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Nowa Rola
                </Button>
            </div>

            {roles && roles.length > 0 ? (
                <RolesTable roles={roles} onEdit={handleEdit} onDelete={handleDeleteClick} />
            ) : (
                <EmptyState
                    title="Brak ról"
                    description="Nie zdefiniowano jeszcze żadnych ról w systemie."
                    actionLabel="Utwórz pierwszą rolę"
                    onAction={handleCreate}
                />
            )}

            <RoleDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                role={selectedRole}
                allPermissions={permissions || []}
            />

            <ModalConfirm
                isOpen={!!roleToDelete}
                onClose={() => setRoleToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Czy na pewno chcesz usunąć tę rolę?"
                description={`Rola "${roleToDelete?.name}" zostanie trwale usunięta. Tej operacji nie można cofnąć.`}
                confirmText="Usuń"
                cancelText="Anuluj"
                variant="destructive"
                isLoading={deleteMutation.isPending}
            />
        </div>
    )
}
