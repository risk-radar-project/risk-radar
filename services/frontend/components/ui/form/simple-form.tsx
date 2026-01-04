"use client"

import type { SubmitHandler } from "react-hook-form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form } from "@/components/ui/form"
import type { ZodTypeAny } from "zod"

interface SimpleFormProps {
    schema: ZodTypeAny
    defaultValues?: Record<string, unknown>
    onSubmit: SubmitHandler<unknown>
    children: React.ReactNode
}

export function SimpleForm({ schema, defaultValues, onSubmit, children }: SimpleFormProps) {
    const form = useForm({
        resolver: zodResolver(schema as never),
        defaultValues: defaultValues ?? {}
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {children}
            </form>
        </Form>
    )
}
