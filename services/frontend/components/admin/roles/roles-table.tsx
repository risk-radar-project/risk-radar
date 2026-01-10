"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/ux/badge"
import { Role } from "@/lib/api/authz"
import { Edit2, ShieldAlert, Trash2, Users } from "lucide-react"

interface RolesTableProps {
    roles: Role[]
    onEdit: (role: Role) => void
    onDelete: (role: Role) => void
}

export function RolesTable({ roles, onEdit, onDelete }: RolesTableProps) {
    return (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <Table>
                <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                        <TableHead className="w-[20%] text-zinc-400">Nazwa Roli</TableHead>
                        <TableHead className="hidden w-[40%] text-zinc-400 md:table-cell">Opis</TableHead>
                        <TableHead className="w-[15%] text-center text-zinc-400">Użytkownicy</TableHead>
                        <TableHead className="w-[10%] text-center text-zinc-400">Uprawnienia</TableHead>
                        <TableHead className="w-[15%] text-right text-zinc-400">Akcje</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {roles.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                                Brak ról do wyświetlenia
                            </TableCell>
                        </TableRow>
                    ) : (
                        roles.map((role, index) => (
                            <TableRow key={role.id || `role-${index}`} className="border-zinc-800 hover:bg-zinc-800/50">
                                <TableCell className="font-medium text-zinc-200">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                                            <ShieldAlert className="h-5 w-5 text-zinc-400" />
                                        </div>
                                        {role.name}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden text-zinc-400 md:table-cell">
                                    {role.description || "-"}
                                </TableCell>
                                <TableCell className="text-center text-zinc-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <Users className="h-4 w-4" />
                                        <span>{role.userCount}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="default" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                                        {role.permissions?.length || 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(role)}
                                            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                            title="Edytuj rolę"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(role)}
                                            className="h-8 w-8 text-zinc-400 hover:bg-red-900/20 hover:text-red-400"
                                            title="Usuń rolę"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
