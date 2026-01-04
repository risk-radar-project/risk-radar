"use client"

import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

interface TextFieldProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>
    name: FieldPath<TFieldValues>
    label: string
    placeholder?: string
}

export function TextField<TFieldValues extends FieldValues>({ control, name, label, placeholder }: TextFieldProps<TFieldValues>) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Input {...field} placeholder={placeholder} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
