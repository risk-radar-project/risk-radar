"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form"
import { Controller, FormProvider, useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
    name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormItemContext = React.createContext<{ id: string }>({} as { id: string })

const FormField = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
    props: ControllerProps<TFieldValues, TName>
) => {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    )
}

const useFormField = () => {
    const fieldContext = React.useContext(FormFieldContext)
    const itemContext = React.useContext(FormItemContext)
    const { getFieldState, formState } = useFormContext()

    if (!fieldContext) {
        throw new Error("useFormField should be used within <FormField>")
    }

    const fieldState = getFieldState(fieldContext.name, formState)
    const id = itemContext?.id

    return {
        id,
        name: fieldContext.name,
        formItemId: id ? `${id}-form-item` : undefined,
        formDescriptionId: id ? `${id}-form-item-description` : undefined,
        formMessageId: id ? `${id}-form-item-message` : undefined,
        ...fieldState
    }
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
    const id = React.useId()

    return (
        <FormItemContext.Provider value={{ id }}>
            <div ref={ref} className={cn("space-y-2", className)} {...props} />
        </FormItemContext.Provider>
    )
})

FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => {
        const { formItemId } = useFormField()

        return <label ref={ref} className={cn("text-sm font-medium", className)} htmlFor={formItemId} {...props} />
    }
)

FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
    ({ ...props }, ref) => {
        const { formItemId, formDescriptionId, formMessageId } = useFormField()
        const describedBy = [formDescriptionId, formMessageId].filter(Boolean).join(" ") || undefined

        return <Slot ref={ref} id={formItemId} aria-describedby={describedBy} {...props} />
    }
)

FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => {
        const { formDescriptionId } = useFormField()

        return <p ref={ref} id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />
    }
)

FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, children, ...props }, ref) => {
        const { formMessageId, error } = useFormField()
        const body = error ? String(error.message) : children

        if (!body) {
            return null
        }

        return (
            <p ref={ref} id={formMessageId} className={cn("text-sm font-medium text-destructive", className)} {...props}>
                {body}
            </p>
        )
    }
)

FormMessage.displayName = "FormMessage"

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage }
