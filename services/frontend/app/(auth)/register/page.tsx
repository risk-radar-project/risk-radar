"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        terms: false
    })
    const [errors, setErrors] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        terms: "",
        form: ""
    })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false)

    useEffect(() => {
        const checkToken = async () => {
            const token = localStorage.getItem("access_token")
            if (token) {
                try {
                    const { isTokenExpired } = await import("@/lib/auth/jwt-utils")
                    if (!isTokenExpired(token)) {
                        setIsAlreadyLoggedIn(true)
                    } else {
                        localStorage.removeItem("access_token")
                        localStorage.removeItem("refresh_token")
                    }
                } catch {
                    localStorage.removeItem("access_token")
                    localStorage.removeItem("refresh_token")
                }
            }
        }
        checkToken()
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
        if (errors[id as keyof typeof errors]) {
            setErrors((prev) => ({ ...prev, [id]: "" }))
        }
    }

    const handleErrorReset = (field: string) => {
        setErrors((prev) => ({ ...prev, [field]: "" }))
    }

    const handleSubmit = async () => {
        const newErrors = { username: "", email: "", password: "", confirmPassword: "", terms: "", form: "" }
        let isValid = true

        if (!formData.username) {
            newErrors.username = "Nazwa użytkownika jest wymagana"
            isValid = false
        }

        if (!formData.email) {
            newErrors.email = "Email jest wymagany"
            isValid = false
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Niepoprawny format emaila"
            isValid = false
        }

        if (!formData.password) {
            newErrors.password = "Hasło jest wymagane"
            isValid = false
        } else {
            const hasUpperCase = /[A-Z]/.test(formData.password)
            const hasLowerCase = /[a-z]/.test(formData.password)
            const hasNumbers = /\d/.test(formData.password)
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
            const hasMinLength = formData.password.length >= 8

            if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
                newErrors.password = "Hasło musi mieć min. 8 znaków, dużą i małą literę, cyfrę oraz znak specjalny"
                isValid = false
            }
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Hasła muszą być identyczne"
            isValid = false
        }

        if (!formData.terms) {
            newErrors.terms = "Musisz zaakceptować regulamin"
            isValid = false
        }

        setErrors(newErrors)

        if (isValid) {
            setIsLoading(true)
            try {
                const response = await fetch("http://localhost:8090/api/users/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: formData.username,
                        email: formData.email,
                        password: formData.password
                    })
                })

                if (response.ok) {
                    // Redirect to login page on success
                    window.location.href = "/login?registered=true"
                } else {
                    setIsLoading(false)
                    // Handle specific error codes
                    if (response.status === 409) {
                        setErrors((prev) => ({
                            ...prev,
                            form: "Użytkownik o podanej nazwie lub adresie email już istnieje."
                        }))
                    } else {
                        try {
                            const data = await response.json()
                            setErrors((prev) => ({ ...prev, form: data.error || "Wystąpił błąd podczas rejestracji" }))
                        } catch {
                            setErrors((prev) => ({
                                ...prev,
                                form: "Wystąpił błąd podczas rejestracji (Błąd parsowania odpowiedzi)"
                            }))
                        }
                    }
                }
            } catch (error) {
                setIsLoading(false)
                console.error("Rejestracja error:", error)
                setErrors((prev) => ({ ...prev, form: "Błąd połączenia z serwerem. Sprawdź, czy serwer działa." }))
            }
        }
    }
    return (
        <div className="mt-6 w-full">
            <div className="pb-3">
                <div className="flex justify-between border-b border-[#54473b]">
                    <Link
                        className="flex flex-1 flex-col items-center justify-center border-b-[3px] border-b-transparent pt-4 pb-[13px] text-[#baab9c]"
                        href="/login"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-[#baab9c]">Logowanie</p>
                    </Link>
                    <Link
                        className={`border-b-primary flex flex-1 flex-col items-center justify-center border-b-[3px] pt-4 pb-[13px] text-white ${isAlreadyLoggedIn ? "pointer-events-none opacity-50" : ""}`}
                        href="/register"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-white">Rejestracja</p>
                    </Link>
                </div>
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit()
                }}
                className="flex flex-col gap-4 py-3"
            >
                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="username">
                        Nazwa użytkownika
                    </Label>
                    <Input
                        className={`form-input focus:ring-primary/50 flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border text-white focus:ring-2 focus:outline-0 ${
                            errors.username ? "border-red-500 focus:border-red-500" : "focus:border-primary border-[#54473b]"
                        } h-14 bg-[#27211b] p-[15px] text-base leading-normal font-normal placeholder:text-[#baab9c]`}
                        id="username"
                        placeholder="JanKowalski"
                        type="text"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={isLoading}
                    />
                    {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
                </div>
                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="email">
                        Email
                    </Label>
                    <Input
                        className={`form-input focus:ring-primary/50 flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border text-white focus:ring-2 focus:outline-0 ${
                            errors.email ? "border-red-500 focus:border-red-500" : "focus:border-primary border-[#54473b]"
                        } h-14 bg-[#27211b] p-[15px] text-base leading-normal font-normal placeholder:text-[#baab9c]`}
                        id="email"
                        placeholder="jan.kowalski@example.com"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={isLoading}
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>
                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="password">
                        Hasło
                    </Label>
                    <div
                        className={`flex w-full flex-1 items-center rounded-lg border ${
                            errors.password
                                ? "border-red-500 focus-within:border-red-500"
                                : "focus-within:border-primary border-[#54473b]"
                        } focus-within:ring-primary/50 h-14 overflow-hidden bg-[#27211b] focus-within:ring-2`}
                    >
                        <Input
                            className="form-input flex h-full w-full min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent p-[15px] pr-2 text-base leading-normal font-normal text-white shadow-none placeholder:text-[#baab9c] focus-visible:ring-0 focus-visible:ring-offset-0"
                            id="password"
                            placeholder="Wpisz swoje hasło"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={handleInputChange}
                            disabled={isLoading}
                        />
                        <Button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label="Toggle password visibility"
                            className="flex h-full items-center justify-center rounded-none border-0 bg-transparent px-[15px] text-[#baab9c] shadow-none hover:bg-transparent hover:text-white focus:ring-0"
                            disabled={isLoading}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                </div>
                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="confirm-password">
                        Potwierdź hasło
                    </Label>
                    <div
                        className={`flex w-full flex-1 items-center rounded-lg border ${
                            errors.confirmPassword
                                ? "border-red-500 focus-within:border-red-500"
                                : "focus-within:border-primary border-[#54473b]"
                        } focus-within:ring-primary/50 h-14 overflow-hidden bg-[#27211b] focus-within:ring-2`}
                    >
                        <Input
                            className="form-input flex h-full w-full min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent p-[15px] pr-2 text-base leading-normal font-normal text-white shadow-none placeholder:text-[#baab9c] focus-visible:ring-0 focus-visible:ring-offset-0"
                            id="confirmPassword"
                            placeholder="Wpisz hasło ponownie"
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            disabled={isLoading}
                        />
                        <Button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label="Toggle password visibility"
                            className="flex h-full items-center justify-center rounded-none border-0 bg-transparent px-[15px] text-[#baab9c] shadow-none hover:bg-transparent hover:text-white focus:ring-0"
                            disabled={isLoading}
                        >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="terms"
                        checked={formData.terms}
                        onCheckedChange={(checked) => {
                            setFormData((prev) => ({ ...prev, terms: checked === true }))
                            if (checked) handleErrorReset("terms")
                        }}
                        disabled={isLoading}
                    />
                    <Label htmlFor="terms" className="text-sm leading-none font-medium text-zinc-400">
                        Akceptuję{" "}
                        <Link href="/terms" className="hover:text-primary font-semibold text-white hover:underline">
                            regulamin
                        </Link>
                    </Label>
                </div>
                {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}
                {errors.form && <p className="text-center text-sm text-red-500">{errors.form}</p>}
                <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 focus:ring-primary focus:ring-offset-background-dark flex h-14 w-full items-center justify-center rounded-lg px-6 text-base font-bold text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    disabled={isLoading || isAlreadyLoggedIn}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                            <span>Przetwarzanie...</span>
                        </div>
                    ) : (
                        "Zarejestruj się"
                    )}
                </Button>
            </form>
        </div>
    )
}
