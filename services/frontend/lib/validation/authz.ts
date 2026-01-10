import { z } from "zod"

export const roleSchema = z.object({
    name: z.string().min(1, "Nazwa jest wymagana").max(100, "Nazwa jest zbyt długa"),
    description: z.string().max(500, "Opis jest zbyt długi").optional(),
    permissions: z.array(z.string()).optional() // Array of permission UUIDs
})

export type RoleFormValues = z.infer<typeof roleSchema>
