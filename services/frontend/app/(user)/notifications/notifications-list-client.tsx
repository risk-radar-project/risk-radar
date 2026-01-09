"use client"

import { useState } from "react"
import { RefreshCw, ArrowUpDown, Check, Mail, MailOpen, Eye, Calendar, Info } from "lucide-react"
import { useNotifications, useMarkNotificationAsRead, useMarkNotificationAsUnread } from "@/hooks/use-notifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/ux/skeleton"
import { EmptyState } from "@/components/ui/ux/empty-state"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Notification } from "@/lib/api/notifications"
import { cn } from "@/lib/utils"

// Helper to fallback to metadata content if title/body are invalid
const getNotificationContent = (n: Notification) => {
    // Check if title or body look like placeholders or are missing
    const isTitleTemplate = !n.title || n.title.includes("{{") || n.title.trim() === ""
    const isBodyTemplate = !n.body || n.body.includes("{{") || n.body.trim() === ""

    let title = n.title
    let body = n.body

    if ((isTitleTemplate || isBodyTemplate) && n.metadata) {
        const meta = n.metadata as Record<string, string>

        if (isTitleTemplate && meta.title && typeof meta.title === "string") {
            title = meta.title
        }

        if (isBodyTemplate && meta.body && typeof meta.body === "string") {
            body = meta.body
        }
    }

    return { title, body }
}

type NotificationItemProps = {
    notification: Notification
    onMarkAsRead: (id: string) => void
    onMarkAsUnread: (id: string) => void
    onViewDetails: (notification: Notification) => void
}

function NotificationItem({ notification, onMarkAsRead, onMarkAsUnread, onViewDetails }: NotificationItemProps) {
    const { title, body } = getNotificationContent(notification)

    const handleMarkRead = (e: React.MouseEvent) => {
        e.stopPropagation()
        onMarkAsRead(notification.id)
    }

    const handleMarkUnread = (e: React.MouseEvent) => {
        e.stopPropagation()
        onMarkAsUnread(notification.id)
    }

    return (
        <div
            onClick={() => onViewDetails(notification)}
            className={cn(
                "group relative flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-all hover:bg-zinc-800/50",
                notification.isRead
                    ? "border-zinc-800 bg-zinc-900/50 opacity-75"
                    : "border-zinc-700 bg-zinc-800/40 shadow-none"
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div
                        className={cn(
                            "mt-1 rounded-full p-2 ring-1 ring-inset",
                            notification.isRead
                                ? "bg-zinc-900/50 text-zinc-500 ring-zinc-800"
                                : "bg-white/10 text-white ring-white/20"
                        )}
                    >
                        {notification.isRead ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                    </div>
                    <div className="space-y-1">
                        <h3
                            className={cn(
                                "leading-none font-semibold",
                                notification.isRead ? "text-zinc-400" : "text-zinc-100"
                            )}
                        >
                            {title}
                        </h3>
                        <p className="text-xs text-zinc-500">
                            {new Date(notification.createdAt).toLocaleString("pl-PL", {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                    <Button
                        onClick={(e) => {
                            e.stopPropagation()
                            onViewDetails(notification)
                        }}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        title="Szczegóły"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>

                    {notification.isRead ? (
                        <Button
                            onClick={handleMarkUnread}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                            title="Oznacz jako nieprzeczytane"
                        >
                            <Mail className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleMarkRead}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                            title="Oznacz jako przeczytane"
                        >
                            <MailOpen className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <p className={cn("line-clamp-2 text-sm", notification.isRead ? "text-zinc-500" : "text-zinc-300")}>{body}</p>
        </div>
    )
}

type NotificationsListClientProps = {
    filter: "all" | "unread" | "read"
}

export function NotificationsListClient({ filter }: NotificationsListClientProps) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
    const [localFilter, setLocalFilter] = useState<"all" | "unread" | "read">(filter)
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

    const isReadParam = localFilter === "unread" ? false : localFilter === "read" ? true : undefined

    const { data, isLoading, isError, error, refetch, isFetching } = useNotifications({
        page,
        limit: pageSize,
        isRead: isReadParam
    })

    const markAsReadMutation = useMarkNotificationAsRead()
    const markAsUnreadMutation = useMarkNotificationAsUnread()

    const handleMarkAsRead = (notificationId: string) => {
        markAsReadMutation.mutate(notificationId)
    }

    const handleMarkAsUnread = (notificationId: string) => {
        markAsUnreadMutation.mutate(notificationId)
    }

    const handleRefresh = () => {
        refetch()
    }

    const notifications = data?.data || []
    const pagination = data?.pagination
    const totalPages = pagination ? Math.ceil(pagination.total / pageSize) : 1
    const currentPage = pagination?.page ?? page

    const hasNotifications = notifications.length > 0
    const displayNotifications = [...notifications].sort((a, b) => {
        const da = new Date(a.createdAt).getTime()
        const db = new Date(b.createdAt).getTime()
        return sortDirection === "asc" ? da - db : db - da
    })

    // Prepare content for modal
    const modalContent = selectedNotification ? getNotificationContent(selectedNotification) : null

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg bg-zinc-900" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {isError && (
                <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
                    <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        <span>{error instanceof Error ? error.message : "Wystąpił błąd podczas ładowania powiadomień"}</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                    <Select
                        value={localFilter}
                        onValueChange={(val: "all" | "unread" | "read") => {
                            setLocalFilter(val)
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-[180px] border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectItem value="all">Wszystkie</SelectItem>
                            <SelectItem value="unread">Nieprzeczytane</SelectItem>
                            <SelectItem value="read">Przeczytane</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="default"
                        onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                        className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        <ArrowUpDown className="h-4 w-4" />
                        {sortDirection === "asc" ? "Najstarsze" : "Najnowsze"}
                    </Button>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-sm text-zinc-400">Na stronę:</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(val) => {
                            const next = Number(val)
                            setPageSize(next)
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-[110px] border-zinc-800 bg-zinc-900 text-zinc-100">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                            {[10, 20, 50].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleRefresh}
                        disabled={isFetching}
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        title="Odśwież"
                    >
                        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {!hasNotifications ? (
                <EmptyState title="Brak powiadomień" description="Nie masz żadnych powiadomień spełniających kryteria." />
            ) : (
                <div className="space-y-4">
                    {displayNotifications.map((notification) => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={handleMarkAsRead}
                            onMarkAsUnread={handleMarkAsUnread}
                            onViewDetails={setSelectedNotification}
                        />
                    ))}
                </div>
            )}

            {hasNotifications && (
                <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                    <Button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                        variant="outline"
                        size="sm"
                        className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50"
                    >
                        Poprzednia
                    </Button>
                    <div className="text-sm text-zinc-400">
                        Strona {currentPage} z {totalPages || 1}
                    </div>
                    <Button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= totalPages || isLoading}
                        variant="outline"
                        size="sm"
                        className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50"
                    >
                        Następna
                    </Button>
                </div>
            )}

            <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-[500px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    "rounded-full p-2",
                                    selectedNotification?.isRead
                                        ? "bg-zinc-800 text-zinc-500"
                                        : "bg-blue-500/10 text-blue-400"
                                )}
                            >
                                {selectedNotification?.isRead ? (
                                    <MailOpen className="h-5 w-5" />
                                ) : (
                                    <Mail className="h-5 w-5" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-lg leading-none">Szczegóły powiadomienia</DialogTitle>
                                <DialogDescription className="text-zinc-400">Informacje o zdarzeniu</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {selectedNotification && modalContent && (
                        <div className="mt-4 space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-zinc-100">{modalContent.title}</h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                        {new Date(selectedNotification.createdAt).toLocaleString("pl-PL", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-300">
                                    {modalContent.body}
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                {!selectedNotification.isRead && (
                                    <Button
                                        onClick={() => {
                                            handleMarkAsRead(selectedNotification.id)
                                            setSelectedNotification(null)
                                        }}
                                        variant="default"
                                        className="bg-blue-600 hover:bg-blue-500"
                                    >
                                        <Check className="mr-2 h-4 w-4" />
                                        Oznacz jako przeczytane
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedNotification(null)}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                                >
                                    Zamknij
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
