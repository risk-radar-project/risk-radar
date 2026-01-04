import { z } from "zod"

export const updateEmailSchema = z.object({
    email: z.string().email("Podaj poprawny adres email")
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(8, "Hasło musi mieć min. 8 znaków"),
    newPassword: z.string().min(8, "Hasło musi mieć min. 8 znaków")
})

type UpdateEmailSchema = z.infer<typeof updateEmailSchema>
type ChangePasswordSchema = z.infer<typeof changePasswordSchema>

export type { UpdateEmailSchema, ChangePasswordSchema }
