import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
import { TableRow } from "@/components/ui/table/table-row"
import { TableCell } from "@/components/ui/table/table-cell"

export default function AdminUsersPage() {
    const users = [
        { id: "1", email: "admin@example.com", role: "admin" },
        { id: "2", email: "user@example.com", role: "user" }
    ]

    return (
        <div>
            <h1 className="text-xl font-semibold mb-4">Użytkownicy</h1>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Rola</TableCell>
                    </TableRow>
                </TableHead>

                <tbody>
                    {users.map((u) => (
                        <TableRow key={u.id}>
                            <TableCell>{u.id}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.role}</TableCell>
                        </TableRow>
                    ))}
                </tbody>
            </Table>
        </div>
    )
}
