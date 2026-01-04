"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useState } from "react"
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

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
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
                        } catch (error) {
                            console.error("Błąd parsowania odpowiedzi rejestracji", error)
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
        <form className="w-full mt-6" onSubmit={handleSubmit}>
            <div className="pb-3">
                <div className="flex border-b border-[#54473b] justify-between">
                    <Link
                        className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#baab9c] pb-[13px] pt-4 flex-1"
                        href="/login"
                    >
                        <p className="text-[#baab9c] text-sm font-bold leading-normal tracking-[0.015em]">Logowanie</p>
                    </Link>
                    <Link
                        className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-white pb-[13px] pt-4 flex-1"
                        href="/register"
                    >
                        <p className="text-white text-sm font-bold leading-normal tracking-[0.015em]">Rejestracja</p>
                    </Link>
                </div>
            </div>
            <div className="flex flex-col gap-4 py-3">
                <div className="flex flex-col w-full">
                    <Label className="text-white text-base font-medium leading-normal pb-2" htmlFor="username">
                        Nazwa użytkownika
                    </Label>
                    <Input
                        className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border ${
                            errors.username ? "border-red-500 focus:border-red-500" : "border-[#54473b] focus:border-primary"
                        } bg-[#27211b] h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal`}
                        id="username"
                        placeholder="JanKowalski"
                        type="text"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={isLoading}
                    />
                    {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>
                <div className="flex flex-col w-full">
                    <Label className="text-white text-base font-medium leading-normal pb-2" htmlFor="email">
                        Email
                    </Label>
                    <Input
                        className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border ${
                            errors.email ? "border-red-500 focus:border-red-500" : "border-[#54473b] focus:border-primary"
                        } bg-[#27211b] h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal`}
                        id="email"
                        placeholder="jan.kowalski@example.com"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={isLoading}
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
                <div className="flex flex-col w-full">
                    <Label className="text-white text-base font-medium leading-normal pb-2" htmlFor="password">
                        Hasło
                    </Label>
                    <div
                        className={`flex w-full flex-1 items-center rounded-lg border ${
                            errors.password
                                ? "border-red-500 focus-within:border-red-500"
                                : "border-[#54473b] focus-within:border-primary"
                        } bg-[#27211b] focus-within:ring-2 focus-within:ring-primary/50 h-14 overflow-hidden`}
                    >
                        <Input
                            className="form-input flex w-full min-w-0 flex-1 resize-none border-0 bg-transparent text-white placeholder:text-[#baab9c] focus-visible:ring-0 focus-visible:ring-offset-0 h-full p-[15px] pr-2 text-base font-normal leading-normal rounded-none shadow-none"
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
                            className="h-full text-[#baab9c] flex items-center justify-center px-[15px] hover:text-white bg-transparent border-0 hover:bg-transparent focus:ring-0 rounded-none shadow-none"
                            disabled={isLoading}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                    </div>
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>
                <div className="flex flex-col w-full">
                    <Label className="text-white text-base font-medium leading-normal pb-2" htmlFor="confirm-password">
                        Potwierdź hasło
                    </Label>
                    <div
                        className={`flex w-full flex-1 items-center rounded-lg border ${
                            errors.confirmPassword
                                ? "border-red-500 focus-within:border-red-500"
                                : "border-[#54473b] focus-within:border-primary"
                        } bg-[#27211b] focus-within:ring-2 focus-within:ring-primary/50 h-14 overflow-hidden`}
                    >
                        <Input
                            className="form-input flex w-full min-w-0 flex-1 resize-none border-0 bg-transparent text-white placeholder:text-[#baab9c] focus-visible:ring-0 focus-visible:ring-offset-0 h-full p-[15px] pr-2 text-base font-normal leading-normal rounded-none shadow-none"
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
                            className="h-full text-[#baab9c] flex items-center justify-center px-[15px] hover:text-white bg-transparent border-0 hover:bg-transparent focus:ring-0 rounded-none shadow-none"
                            disabled={isLoading}
                        >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
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
                    <Label htmlFor="terms" className="text-sm font-medium leading-none text-zinc-400">
                        Akceptuję{" "}
                        <Link href="/terms" className="text-white font-semibold hover:text-primary hover:underline">
                            regulamin
                        </Link>
                    </Label>
                </div>
                {errors.terms && <p className="text-red-500 text-sm">{errors.terms}</p>}
                {errors.form && <p className="text-red-500 text-sm text-center">{errors.form}</p>}
            </div>
            <div className="flex flex-col gap-4 pt-3 pb-3">
                <Button
                    type="submit"
                    className="flex h-14 w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            <span>Przetwarzanie...</span>
                        </div>
                    ) : (
                        "Zarejestruj się"
                    )}
                </Button>
            </div>
        </form>
    )
}
