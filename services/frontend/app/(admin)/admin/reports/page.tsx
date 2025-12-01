import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
import { TableRow } from "@/components/ui/table/table-row"
import { TableCell } from "@/components/ui/table/table-cell"

export default function AdminReportsPage() {
    const reports = [
        { id: "r1", title: "Zgłoszenie testowe", status: "pending" }
    ]

    return (
        <div>
            <h1 className="text-xl font-semibold mb-4">Zgłoszenia</h1>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Tytuł</TableCell>
                        <TableCell>Status</TableCell>
                    </TableRow>
                </TableHead>

                <tbody>
                    {reports.map((r) => (
                        <TableRow key={r.id}>
                            <TableCell>{r.id}</TableCell>
                            <TableCell>{r.title}</TableCell>
                            <TableCell>{r.status}</TableCell>
                        </TableRow>
                    ))}
                </tbody>
            </Table>
        </div>
    )
}
