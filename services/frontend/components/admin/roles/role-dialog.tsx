"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

import { Role, Permission, createRole, updateRole } from "@/lib/api/authz"
import { roleSchema, RoleFormValues } from "@/lib/validation/authz"

interface RoleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    role?: Role
    allPermissions: Permission[]
}

export function RoleDialog({ open, onOpenChange, role, allPermissions }: RoleDialogProps) {
    const queryClient = useQueryClient()
    const isEditing = !!role

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: "",
            description: "",
            permissions: []
        }
    })

    // Reset form when dialog opens or role changes
    useEffect(() => {
        if (open) {
            form.reset({
                name: role?.name || "",
                description: role?.description || "",
                permissions: role?.permissions?.map((p) => p.id) || []
            })
        }
    }, [open, role, form])

    const mutation = useMutation({
        mutationFn: async (values: RoleFormValues) => {
            // Map selected permission IDs to { resource, action } objects required by backend
            const selectedPermissions = (values.permissions || [])
                .map((id) => allPermissions.find((p) => p.id === id))
                .filter((p): p is Permission => !!p)
                .map((p) => ({ resource: p.resource, action: p.action }))

            const payload = {
                name: values.name,
                description: values.description || "",
                permissions: selectedPermissions
            }

            if (isEditing && role) {
                return updateRole(role.id, payload)
            } else {
                return createRole(payload)
            }
        },
        onSuccess: () => {
            toast.success(isEditing ? "Rola zaktualizowana" : "Rola utworzona")
            queryClient.invalidateQueries({ queryKey: ["roles"] })
            onOpenChange(false)
        },
        onError: (error: Error) => {
            toast.error(`Błąd: ${error.message}`)
        }
    })

    const onSubmit = (values: RoleFormValues) => {
        mutation.mutate(values)
    }

    // Group permissions by resource for better UI
    const permissionsByResource = allPermissions.reduce(
        (acc, perm) => {
            const resource = perm.resource
            if (!acc[resource]) acc[resource] = []
            acc[resource].push(perm)
            return acc
        },
        {} as Record<string, Permission[]>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[95vh] w-full max-w-5xl flex-col border-[#e0dcd7]/20 bg-[#362c20] text-[#e0dcd7]">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{isEditing ? "Edytuj rolę" : "Nowa rola"}</DialogTitle>
                    <DialogDescription className="text-[#e0dcd7]/70">
                        {isEditing
                            ? "Zmień nazwę, opis i uprawnienia dla tej roli."
                            : "Wypełnij formularz aby utworzyć nową rolę."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 overflow-hidden">
                        <div className="flex flex-col gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nazwa roli</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="np. moderator"
                                                className="border-[#e0dcd7]/20 bg-[#2a221a] text-[#e0dcd7] placeholder:text-[#e0dcd7]/50 focus-visible:border-[#d97706] focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Opis (opcjonalnie)</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Krótki opis roli..."
                                                className="border-[#e0dcd7]/20 bg-[#2a221a] text-[#e0dcd7] placeholder:text-[#e0dcd7]/50 focus-visible:border-[#d97706] focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                            <FormLabel>Uprawnienia</FormLabel>
                            <div className="custom-scrollbar w-full flex-1 overflow-y-auto rounded-md border border-[#e0dcd7]/20 bg-[#2a221a] p-4">
                                <FormField
                                    control={form.control}
                                    name="permissions"
                                    render={() => (
                                        <div className="space-y-6">
                                            {Object.entries(permissionsByResource).map(([resource, perms]) => (
                                                <div key={resource} className="space-y-2">
                                                    <h4 className="font-semibold text-[#d97706] capitalize">{resource}</h4>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                        {perms.map((perm) => (
                                                            <FormField
                                                                key={perm.id}
                                                                control={form.control}
                                                                name="permissions"
                                                                render={({ field }) => {
                                                                    return (
                                                                        <FormItem
                                                                            key={perm.id}
                                                                            className="flex flex-row items-start space-y-0 space-x-3"
                                                                        >
                                                                            <FormControl>
                                                                                <Checkbox
                                                                                    checked={field.value?.includes(perm.id)}
                                                                                    onCheckedChange={(checked) => {
                                                                                        return checked
                                                                                            ? field.onChange([
                                                                                                  ...(field.value || []),
                                                                                                  perm.id
                                                                                              ])
                                                                                            : field.onChange(
                                                                                                  field.value?.filter(
                                                                                                      (value) =>
                                                                                                          value !== perm.id
                                                                                                  )
                                                                                              )
                                                                                    }}
                                                                                    className="border-[#e0dcd7]/50 data-[state=checked]:border-[#d97706] data-[state=checked]:bg-[#d97706]"
                                                                                />
                                                                            </FormControl>
                                                                            <div className="space-y-1 leading-none">
                                                                                <FormLabel className="font-normal">
                                                                                    {perm.name}
                                                                                </FormLabel>
                                                                                <p className="text-xs text-[#e0dcd7]/50">
                                                                                    {perm.description}
                                                                                </p>
                                                                            </div>
                                                                        </FormItem>
                                                                    )
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-[#e0dcd7]/20 bg-transparent text-[#e0dcd7] hover:bg-[#e0dcd7]/10 hover:text-[#e0dcd7]"
                            >
                                Anuluj
                            </Button>
                            <Button
                                type="submit"
                                disabled={mutation.isPending}
                                className="border-0 bg-[#d97706] text-[#120c07] hover:bg-[#d97706]/90"
                            >
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? "Zapisz zmiany" : "Utwórz rolę"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
