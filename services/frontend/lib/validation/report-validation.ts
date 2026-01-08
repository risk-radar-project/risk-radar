import { z } from "zod"

/**
 * Validation schema for report submission
 * Enforces strict input constraints to prevent malicious data
 */
export const ReportValidationSchema = z.object({
    title: z
        .string()
        .min(3, "Tytuł musi mieć co najmniej 3 znaki")
        .max(255, "Tytuł nie może być dłuższy niż 255 znaków")
        .trim()
        .refine((val) => val.length > 0, "Tytuł nie może być pusty"),

    description: z.string().max(2000, "Opis nie może być dłuższy niż 2000 znaków").optional().default(""),

    category: z.enum([
        "VANDALISM",
        "INFRASTRUCTURE",
        "DANGEROUS_SITUATION",
        "TRAFFIC_ACCIDENT",
        "PARTICIPANT_BEHAVIOR",
        "PARTICIPANT_HAZARD",
        "WASTE_ILLEGAL_DUMPING",
        "BIOLOGICAL_HAZARD",
        "OTHER"
    ]),

    latitude: z
        .number()
        .min(-90, "Szerokość geograficzna musi być pomiędzy -90 a 90")
        .max(90, "Szerokość geograficzna musi być pomiędzy -90 a 90"),

    longitude: z
        .number()
        .min(-180, "Długość geograficzna musi być pomiędzy -180 a 180")
        .max(180, "Długość geograficzna musi być pomiędzy -180 a 180"),

    imageIds: z.array(z.string().uuid("Nieprawidłowe ID obrazu")).optional().default([])
})

export type ReportValidation = z.infer<typeof ReportValidationSchema>

/**
 * Helper function to validate report data
 * Returns validation result with errors if validation fails
 */
export function validateReport(data: unknown) {
    try {
        const validatedData = ReportValidationSchema.parse(data)
        return {
            success: true,
            data: validatedData,
            errors: null
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMap: Record<string, string> = {}
            error.issues.forEach((err) => {
                const path = err.path.join(".")
                errorMap[path] = err.message
            })
            return {
                success: false,
                data: null,
                errors: errorMap
            }
        }
        return {
            success: false,
            data: null,
            errors: { general: "Błąd walidacji danych" }
        }
    }
}

/**
 * Validation schema for user input fields (sanitization)
 */
export const SanitizedStringSchema = z.string().transform((val) => {
    // Basic sanitization: keep spaces intact, strip only dangerous substrings
    return val
        .replace(/[<>\"']/g, "") // Remove HTML special chars
        .replace(/javascript:/gi, "") // Remove javascript: protocol
})

/**
 * Safe input validation with sanitization
 */
export function validateAndSanitize(input: string): string {
    try {
        return SanitizedStringSchema.parse(input)
    } catch {
        return ""
    }
}
