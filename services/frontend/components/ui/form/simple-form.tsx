"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form } from "@/components/ui/form"

export function SimpleForm({ schema, defaultValues, onSubmit, children }: any) {
    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {children}
            </form>
        </Form>
    )
}
