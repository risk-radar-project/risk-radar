"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getMyReports, deleteReport, updateReport } from "@/lib/api/reports"
import { Report } from "@/lib/api/types"
import { format, formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/ux"
import { Loader, EmptyState, ModalConfirm } from "@/components/ui/ux"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    MoreHorizontal,
    Trash,
    Eye,
    ArrowUpDown,
    AlertTriangle,
    Car,
    Construction,
    HelpCircle,
    SprayCan,
    Trash2,
    Users,
    Biohazard,
    Siren,
    Edit,
    MapPin
} from "lucide-react"
import { toast } from "sonner"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    VANDALISM: SprayCan,
    INFRASTRUCTURE: Construction,
    DANGEROUS_SITUATION: Siren,
    TRAFFIC_ACCIDENT: Car,
    PARTICIPANT_BEHAVIOR: Users,
    PARTICIPANT_HAZARD: AlertTriangle,
    WASTE_ILLEGAL_DUMPING: Trash2,
    BIOLOGICAL_HAZARD: Biohazard,
    OTHER: HelpCircle
}

const CATEGORY_LABELS: Record<string, string> = {
    VANDALISM: "Wandalizm",
    INFRASTRUCTURE: "Infrastruktura",
    DANGEROUS_SITUATION: "Niebezpieczne sytuacje",
    TRAFFIC_ACCIDENT: "Wypadki drogowe",
    PARTICIPANT_BEHAVIOR: "Zachowania uczestników",
    PARTICIPANT_HAZARD: "Zagrożenia",
    WASTE_ILLEGAL_DUMPING: "Śmieci / nielegalne wysypiska",
    BIOLOGICAL_HAZARD: "Zagrożenia biologiczne",
    OTHER: "Inne"
}

const STATUS_ROW_STYLES: Record<string, string> = {
    VERIFIED: "bg-green-950/10 hover:bg-green-900/20",
    REJECTED: "bg-red-950/10 hover:bg-red-900/20",
    PENDING: "hover:bg-zinc-800/50"
}

const formatCategoryLabel = (category?: string) => {
    if (!category) return "-"
    const translated = CATEGORY_LABELS[category]
    if (translated) return translated
    const normalized = category.replace(/_/g, " ").toLowerCase()
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function MyReportsClient() {
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [sort, setSort] = useState("createdAt")
    const [direction, setDirection] = useState("desc")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [categoryFilter, setCategoryFilter] = useState("ALL")
    const [selectedReport, setSelectedReport] = useState<Report | null>(null)
    const [reportToDelete, setReportToDelete] = useState<string | null>(null)
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null)
    const [editFormData, setEditFormData] = useState({ title: "", description: "", category: "" })

    const queryClient = useQueryClient()

    const getImageUrl = (imageId: string, variant?: "thumb" | "preview") => {
        // Don't pass token in URL - it will be sent via Authorization header by the browser
        if (variant) {
            return `/api/image/${imageId}?variant=${variant}`
        }
        return `/api/image/${imageId}`
    }

    const { data, isLoading, isError } = useQuery({
        queryKey: ["my-reports", page, pageSize, sort, direction, statusFilter, categoryFilter],
        queryFn: async () => (await getMyReports(page, pageSize, sort, direction, statusFilter, categoryFilter)).data
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await deleteReport(id)
        },
        onSuccess: () => {
            toast.success("Zgłoszenie zostało usunięte")
            queryClient.invalidateQueries({ queryKey: ["my-reports"] })
            setReportToDelete(null)
        },
        onError: () => {
            toast.error("Nie udało się usunąć zgłoszenia")
        }
    })

    const updateMutation = useMutation({
        mutationFn: async ({
            id,
            data
        }: {
            id: string
            data: { title: string; description: string; category?: string }
        }) => {
            await updateReport(id, data)
        },
        onSuccess: () => {
            toast.success("Zgłoszenie zostało zaktualizowane")
            queryClient.invalidateQueries({ queryKey: ["my-reports"] })
            setReportToEdit(null)
        },
        onError: () => {
            toast.error("Nie udało się zaktualizować zgłoszenia")
        }
    })

    const handleEditOpen = (report: Report) => {
        setReportToEdit(report)
        setEditFormData({
            title: report.title,
            description: report.description,
            category: report.category || ""
        })
    }

    const handleEditSubmit = () => {
        if (!reportToEdit) return
        updateMutation.mutate({
            id: reportToEdit.id,
            data: {
                title: editFormData.title,
                description: editFormData.description,
                category: editFormData.category || undefined
            }
        })
    }

    const handleSort = (column: string) => {
        if (sort === column) {
            setDirection(direction === "asc" ? "desc" : "asc")
        } else {
            setSort(column)
            setDirection("desc")
        }
    }

    if (isLoading) return <Loader />
    if (isError) return <div className="text-red-500">Błąd podczas ładowania zgłoszeń.</div>

    const pagePayload = data as Record<string, unknown> | undefined

    // Safe number extraction helper
    const toNumber = (value: unknown, fallback: number): number => {
        const num = Number(value)
        return !isNaN(num) && isFinite(num) ? num : fallback
    }

    const reports = (pagePayload?.content as Report[] | undefined) ?? []

    // Handle both nested page object and flat structure
    const pageInfo = (pagePayload?.page as Record<string, unknown> | undefined) ?? pagePayload
    const apiPageNumber = toNumber(pageInfo?.number ?? pageInfo?.page, page)
    const apiPageSize = toNumber(pageInfo?.size ?? pageInfo?.pageSize, pageSize)
    const apiTotalPages = toNumber(pageInfo?.totalPages ?? pageInfo?.total_pages, 0)
    const apiTotalElements = toNumber(pageInfo?.totalElements ?? pageInfo?.total_elements, 0)

    const effectivePageSize = apiPageSize > 0 ? apiPageSize : pageSize || 1
    const derivedTotalElements = apiTotalElements > 0 ? apiTotalElements : reports.length
    const computedTotalPages = Math.max(1, Math.ceil(derivedTotalElements / effectivePageSize))
    const totalPages = apiTotalPages > 0 ? apiTotalPages : computedTotalPages
    const currentPage = Math.max(0, Math.min(apiPageNumber, totalPages - 1))

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                    <Select
                        value={statusFilter}
                        onValueChange={(val) => {
                            setStatusFilter(val)
                            setPage(0)
                        }}
                    >
                        <SelectTrigger className="w-[180px] border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
                            <SelectItem value="PENDING">Oczekujące</SelectItem>
                            <SelectItem value="VERIFIED">Zweryfikowane</SelectItem>
                            <SelectItem value="REJECTED">Odrzucone</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={categoryFilter}
                        onValueChange={(val) => {
                            setCategoryFilter(val)
                            setPage(0)
                        }}
                    >
                        <SelectTrigger className="w-[220px] border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectValue placeholder="Kategoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie kategorie</SelectItem>
                            <SelectItem value="VANDALISM">Wandalizm</SelectItem>
                            <SelectItem value="INFRASTRUCTURE">Infrastruktura</SelectItem>
                            <SelectItem value="DANGEROUS_SITUATION">Niebezpieczne sytuacje</SelectItem>
                            <SelectItem value="TRAFFIC_ACCIDENT">Wypadki drogowe</SelectItem>
                            <SelectItem value="PARTICIPANT_BEHAVIOR">Zachowania uczestników</SelectItem>
                            <SelectItem value="PARTICIPANT_HAZARD">Zagrożenia</SelectItem>
                            <SelectItem value="WASTE_ILLEGAL_DUMPING">Śmieci</SelectItem>
                            <SelectItem value="BIOLOGICAL_HAZARD">Zagrożenia biologiczne</SelectItem>
                            <SelectItem value="OTHER">Inne</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-sm text-zinc-400">Na stronę:</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(val) => {
                            const nextSize = Number(val)
                            setPageSize(nextSize)
                            setPage(0)
                        }}
                    >
                        <SelectTrigger className="w-[110px] border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 15, 25, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {reports.length === 0 ? (
                <EmptyState
                    title="Brak zgłoszeń"
                    description="Nie dodałeś jeszcze żadnych zgłoszeń."
                    actionLabel="Dodaj zgłoszenie"
                    onAction={() => {
                        // Redirect to add report page
                        window.location.href = "/submit-report"
                    }}
                />
            ) : (
                <>
                    <div className="rounded-md border border-zinc-800 bg-zinc-900">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                    <TableHead className="w-[100px] text-zinc-400">Status</TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleSort("title")}
                                            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                        >
                                            Tytuł
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-zinc-400">Kategoria</TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleSort("createdAt")}
                                            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                        >
                                            Data dodania
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right text-zinc-400">Akcje</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reports.map((report) => {
                                    const Icon = report.category ? CATEGORY_ICONS[report.category] || HelpCircle : HelpCircle
                                    return (
                                        <TableRow
                                            key={report.id}
                                            className={cn(
                                                "group cursor-pointer border-zinc-800 transition-colors",
                                                STATUS_ROW_STYLES[report.status] || "hover:bg-zinc-800/50"
                                            )}
                                            onClick={() => setSelectedReport(report)}
                                        >
                                            <TableCell>
                                                <Badge variant={getStatusVariant(report.status)}>{report.status}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{report.title}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="text-muted-foreground h-4 w-4" />
                                                    <span>{formatCategoryLabel(report.category)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {formatDistanceToNow(new Date(report.createdAt), {
                                                            addSuffix: true,
                                                            locale: pl
                                                        })}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {format(new Date(report.createdAt), "dd MMM yyyy, HH:mm", {
                                                            locale: pl
                                                        })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedReport(report)
                                                            }}
                                                            className="hover:bg-zinc-800 hover:text-blue-400"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleEditOpen(report)
                                                            }}
                                                            className="hover:bg-zinc-800 hover:text-yellow-400"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setReportToDelete(report.id)
                                                            }}
                                                            className="hover:bg-zinc-800 hover:text-red-400"
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 md:hidden">
                                                                <span className="sr-only">Otwórz menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => setSelectedReport(report)}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                Szczegóły
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleEditOpen(report)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edytuj
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setReportToDelete(report.id)}
                                                                className="text-red-600 focus:text-red-600"
                                                            >
                                                                <Trash className="mr-2 h-4 w-4" />
                                                                Usuń
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50"
                        >
                            Poprzednia
                        </Button>
                        <div className="text-sm text-zinc-400">
                            Strona {currentPage + 1} z {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage + 1 >= totalPages}
                            className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50"
                        >
                            Następna
                        </Button>
                    </div>
                </>
            )}

            {/* Details Modal */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Szczegóły zgłoszenia</DialogTitle>
                        <DialogDescription className="text-zinc-400">ID: {selectedReport?.id}</DialogDescription>
                    </DialogHeader>
                    {selectedReport && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="font-bold">Tytuł:</span>
                                <span className="col-span-3">{selectedReport.title}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="font-bold">Opis:</span>
                                <span className="col-span-3">{selectedReport.description}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="font-bold">Status:</span>
                                <span className="col-span-3">
                                    <Badge variant={getStatusVariant(selectedReport.status)}>{selectedReport.status}</Badge>
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="font-bold">Kategoria:</span>
                                <span className="col-span-3">{formatCategoryLabel(selectedReport.category)}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="font-bold">Data:</span>
                                <span className="col-span-3">
                                    {format(new Date(selectedReport.createdAt), "dd MMMM yyyy, HH:mm:ss", {
                                        locale: pl
                                    })}
                                </span>
                            </div>
                            {selectedReport.latitude && selectedReport.longitude && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <span className="font-bold">Lokalizacja:</span>
                                    <div className="col-span-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                window.open(
                                                    `/map?lat=${selectedReport.latitude}&lng=${selectedReport.longitude}`,
                                                    "_blank"
                                                )
                                            }}
                                            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                                        >
                                            <MapPin className="mr-2 h-4 w-4" />
                                            Pokaż na mapie
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {selectedReport.imageIds && selectedReport.imageIds.length > 0 && (
                                <div>
                                    <span className="mb-2 block font-bold">Zdjęcia:</span>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {selectedReport.imageIds.map((imageId) => (
                                            <div
                                                key={imageId}
                                                className="group relative aspect-square overflow-hidden rounded-md border border-zinc-800"
                                            >
                                                <img
                                                    src={getImageUrl(imageId, "thumb")}
                                                    alt="Report image"
                                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                    onError={(e) => {
                                                        e.currentTarget.src =
                                                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23444' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23888' font-size='14'%3EBrak obrazu%3C/text%3E%3C/svg%3E"
                                                    }}
                                                />
                                                <button
                                                    onClick={() => window.open(getImageUrl(imageId), "_blank")}
                                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                                                >
                                                    <Eye className="h-6 w-6 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedReport.aiIsFake !== undefined && (
                                <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-4">
                                    <h4 className="mb-2 font-semibold text-zinc-100">Analiza AI</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
                                        <span>Fake: {selectedReport.aiIsFake ? "Tak" : "Nie"}</span>
                                        <span>
                                            Prawdopodobieństwo: {(selectedReport.aiFakeProbability! * 100).toFixed(1)}%
                                        </span>
                                        <span>Pewność: {selectedReport.aiConfidence}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={!!reportToEdit} onOpenChange={(open) => !open && setReportToEdit(null)}>
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edytuj zgłoszenie</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Wprowadź zmiany i kliknij &quot;Zapisz&quot;
                        </DialogDescription>
                    </DialogHeader>
                    {reportToEdit && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-title">Tytuł</Label>
                                <Input
                                    id="edit-title"
                                    value={editFormData.title}
                                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-100"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-description">Opis</Label>
                                <Textarea
                                    id="edit-description"
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-100"
                                    rows={4}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-category">Kategoria</Label>
                                <Select
                                    value={editFormData.category}
                                    onValueChange={(val) => setEditFormData({ ...editFormData, category: val })}
                                >
                                    <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100">
                                        <SelectValue placeholder="Wybierz kategorię" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VANDALISM">Wandalizm</SelectItem>
                                        <SelectItem value="INFRASTRUCTURE">Infrastruktura</SelectItem>
                                        <SelectItem value="DANGEROUS_SITUATION">Niebezpieczne sytuacje</SelectItem>
                                        <SelectItem value="TRAFFIC_ACCIDENT">Wypadki drogowe</SelectItem>
                                        <SelectItem value="PARTICIPANT_BEHAVIOR">Zachowania uczestników</SelectItem>
                                        <SelectItem value="PARTICIPANT_HAZARD">Zagrożenia</SelectItem>
                                        <SelectItem value="WASTE_ILLEGAL_DUMPING">Śmieci</SelectItem>
                                        <SelectItem value="BIOLOGICAL_HAZARD">Zagrożenia biologiczne</SelectItem>
                                        <SelectItem value="OTHER">Inne</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setReportToEdit(null)}
                                    className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                                >
                                    Anuluj
                                </Button>
                                <Button
                                    onClick={handleEditSubmit}
                                    disabled={updateMutation.isPending || !editFormData.title || !editFormData.description}
                                    className="bg-[#d97706] text-[#120c07] hover:bg-[#f59e0b]"
                                >
                                    {updateMutation.isPending ? "Zapisywanie..." : "Zapisz"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ModalConfirm
                isOpen={!!reportToDelete}
                onClose={() => setReportToDelete(null)}
                onConfirm={() => reportToDelete && deleteMutation.mutate(reportToDelete)}
                title="Usuń zgłoszenie"
                description="Czy na pewno chcesz usunąć to zgłoszenie? Tej operacji nie można cofnąć."
                confirmText="Usuń"
                cancelText="Anuluj"
                variant="destructive"
                isLoading={deleteMutation.isPending}
            />
        </div>
    )
}

function getStatusVariant(status: string) {
    switch (status) {
        case "VERIFIED":
            return "success"
        case "REJECTED":
            return "danger"
        case "PENDING":
        default:
            return "warning"
    }
}
