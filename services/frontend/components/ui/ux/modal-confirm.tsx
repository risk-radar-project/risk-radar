"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function ModalConfirm({
    onConfirm,
    title,
    description
}: {
    onConfirm: () => void
    title: string
    description: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button variant="destructive" onClick={() => setOpen(true)}>
                Usuń
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <h2 className="text-lg font-semibold">{title}</h2>
                    </DialogHeader>
                    <p className="text-sm text-zinc-400">{description}</p>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Anuluj
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onConfirm()
                                setOpen(false)
                            }}
                        >
                            Potwierdź
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
