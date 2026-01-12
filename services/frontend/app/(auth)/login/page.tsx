"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, UserCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { GATEWAY_URL } from "@/lib/auth/auth-service"

const DEMO_ACCOUNTS = [
    { label: "👑 Admin", username: "admin", password: "admin" },
    { label: "🛡️ Moderator", username: "moderator", password: "moderator" },
    { label: "🤝 Wolontariusz", username: "wolontariusz", password: "wolontariusz" },
    { label: "👤 Użytkownik", username: "uzytkownik", password: "uzytkownik" }
]

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [showDemoAccounts, setShowDemoAccounts] = useState(true)
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        rememberMe: false
    })
    const [errors, setErrors] = useState({
        username: "",
        password: "",
        form: ""
    })
    const [successMessage, setSuccessMessage] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false)
    const searchParams = useSearchParams()

    useEffect(() => {
        // Import isTokenExpired dynamically to avoid issues
        const checkToken = async () => {
            const token = localStorage.getItem("access_token")
            if (token) {
                // Check if token is valid by trying to parse it
                try {
                    const { isTokenExpired } = await import("@/lib/auth/jwt-utils")
                    if (!isTokenExpired(token)) {
                        setIsAlreadyLoggedIn(true)
                    } else {
                        // Token is expired, clear it so user can log in
                        localStorage.removeItem("access_token")
                        localStorage.removeItem("refresh_token")
                    }
                } catch {
                    // If there's an error parsing, clear the token
                    localStorage.removeItem("access_token")
                    localStorage.removeItem("refresh_token")
                }
            }
        }
        checkToken()
    }, [])

    useEffect(() => {
        if (searchParams.get("registered") === "true") {
            setSuccessMessage("Rejestracja zakończona sukcesem. Możesz się teraz zalogować.")
        }
    }, [searchParams])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
        if (errors[id as keyof typeof errors]) {
            setErrors((prev) => ({ ...prev, [id]: "" }))
        }
    }

    const handleDemoLogin = (username: string, password: string) => {
        setFormData((prev) => ({ ...prev, username, password }))
        setShowDemoAccounts(false)
        setErrors({ username: "", password: "", form: "" })
    }

    const handleSubmit = async () => {
        const newErrors = { username: "", password: "", form: "" }
        let isValid = true

        if (!formData.username) {
            newErrors.username = "Nazwa użytkownika lub email jest wymagany"
            isValid = false
        }

        if (!formData.password) {
            newErrors.password = "Hasło jest wymagane"
            isValid = false
        }

        setErrors(newErrors)

        if (isValid) {
            setIsLoading(true)
            try {
                const response = await fetch(`${GATEWAY_URL}/api/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: formData.username,
                        password: formData.password,
                        rememberMe: formData.rememberMe
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    // Store tokens in localStorage (support both camelCase and snake_case)
                    const accessToken = data.accessToken || data.access_token || data.token
                    const refreshToken = data.refreshToken || data.refresh_token

                    if (accessToken) localStorage.setItem("access_token", accessToken)
                    if (refreshToken) localStorage.setItem("refresh_token", refreshToken)

                    setSuccessMessage("Pomyślnie zalogowano! Trwa przekierowanie...")

                    // Delay redirect to show success message and simple loader
                    setTimeout(() => {
                        window.location.href = "/"
                    }, 1500)
                } else {
                    setIsLoading(false)
                    let data = null
                    try {
                        data = await response.json()
                    } catch (e) {
                        console.warn("Failed to parse error response JSON", e)
                    }

                    const rawMessage =
                        data && typeof data.error === "string"
                            ? data.error
                            : data && data.message
                              ? String(data.message)
                              : ""

                    const normalizedMessage = rawMessage.toLowerCase()
                    const isBanned =
                        response.status === 403 ||
                        response.status === 423 ||
                        normalizedMessage.includes("ban") ||
                        normalizedMessage.includes("blok") ||
                        normalizedMessage.includes("zablok")

                    if (isBanned) {
                        setErrors((prev) => ({ ...prev, form: "Konto jest zablokowane. Skontaktuj się z administratorem." }))
                    } else if (response.status === 401) {
                        setErrors((prev) => ({ ...prev, form: "Nieprawidłowa nazwa użytkownika lub hasło" }))
                    } else {
                        const errorMessage = rawMessage || "Wystąpił błąd podczas logowania"
                        setErrors((prev) => ({ ...prev, form: errorMessage }))
                    }
                }
            } catch (error) {
                setIsLoading(false)
                console.error("Login error:", error)
                setErrors((prev) => ({ ...prev, form: "Błąd połączenia z serwerem" }))
            }
        }
    }

    if (isLoading && successMessage) {
        return (
            <div className="mt-6 flex min-h-[300px] w-full flex-col items-center justify-center text-white">
                <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-t-2 border-b-2"></div>
                <p className="text-lg font-medium text-green-500">{successMessage}</p>
            </div>
        )
    }

    return (
        <div className="mt-6 w-full">
            {successMessage && !isLoading && (
                <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-center text-sm text-green-500">
                    {successMessage}
                </div>
            )}
            <div className="flex w-full flex-col items-center">
                <h1 className="tracking-light pt-6 pb-3 text-center text-[32px] leading-tight font-bold text-white">
                    RiskRadar
                </h1>
                <p className="px-4 pt-1 pb-3 text-center text-base leading-normal font-normal text-zinc-400 dark:text-white">
                    Zaloguj się lub Utwórz konto, aby rozpocząć.
                </p>
            </div>
            <div className="pb-3">
                <div className="flex justify-between border-b border-[#54473b]">
                    <Link
                        className="border-b-primary flex flex-1 flex-col items-center justify-center border-b-[3px] pt-4 pb-[13px] text-white"
                        href="/login"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-white">Logowanie</p>
                    </Link>
                    <Link
                        className={`flex flex-1 flex-col items-center justify-center border-b-[3px] border-b-transparent pt-4 pb-[13px] text-[#baab9c] ${isAlreadyLoggedIn ? "pointer-events-none opacity-50" : ""}`}
                        href="/register"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-[#baab9c]">Rejestracja</p>
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
                {/* Demo Accounts Section */}
                <div className="mb-2">
                    <button
                        type="button"
                        onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#54473b] bg-[#27211b]/50 px-4 py-2.5 text-sm font-medium text-[#baab9c] transition-colors hover:bg-[#27211b] hover:text-white"
                        disabled={isLoading || isAlreadyLoggedIn}
                    >
                        <UserCircle className="h-4 w-4" />
                        <span>{showDemoAccounts ? "Ukryj konta demo" : "Pokaż konta demo"}</span>
                    </button>

                    {showDemoAccounts && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {DEMO_ACCOUNTS.map((account) => (
                                <button
                                    key={account.username}
                                    type="button"
                                    onClick={() => handleDemoLogin(account.username, account.password)}
                                    className="rounded-lg border border-[#54473b] bg-[#27211b] px-3 py-2 text-xs font-medium text-[#baab9c] transition-colors hover:border-[#d97706] hover:bg-[#d97706]/10 hover:text-[#d97706]"
                                    disabled={isLoading || isAlreadyLoggedIn}
                                >
                                    {account.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="username">
                        Email lub login
                    </Label>
                    <Input
                        className={`form-input focus:ring-primary/50 flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border text-white focus:ring-2 focus:outline-0 ${
                            errors.username ? "border-red-500 focus:border-red-500" : "focus:border-primary border-[#54473b]"
                        } h-14 bg-[#27211b] p-[15px] text-base leading-normal font-normal placeholder:text-[#baab9c]`}
                        id="username"
                        placeholder="jan.kowalski@example.com lub janek"
                        type="text"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={isLoading || isAlreadyLoggedIn}
                    />
                    {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
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
                            disabled={isLoading || isAlreadyLoggedIn}
                        />
                        <Button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label="Toggle password visibility"
                            className="flex h-full items-center justify-center rounded-none border-0 bg-transparent px-[15px] text-[#baab9c] shadow-none hover:bg-transparent hover:text-white focus:ring-0"
                            disabled={isLoading || isAlreadyLoggedIn}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            className="form-checkbox text-primary focus:ring-primary h-4 w-4 rounded border-[#54473b] bg-[#27211b]"
                            id="remember-me"
                            checked={formData.rememberMe}
                            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, rememberMe: checked === true }))}
                            disabled={isLoading || isAlreadyLoggedIn}
                        />
                        <Label className="text-sm text-[#baab9c]" htmlFor="remember-me">
                            Zapamiętaj mnie
                        </Label>
                    </div>
                    <Link className="text-sm text-white hover:underline" href="/reset-password">
                        Nie pamiętasz hasła?
                    </Link>
                </div>
                <Button
                    type="submit"
                    className="flex h-14 w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 focus:ring-offset-[#1a1410] focus:outline-none"
                    disabled={isLoading || isAlreadyLoggedIn}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                            <span>Logowanie...</span>
                        </div>
                    ) : isAlreadyLoggedIn ? (
                        "Jesteś już zalogowany"
                    ) : (
                        "Zaloguj się"
                    )}
                </Button>
            </form>
            {errors.form && (
                <div className="pb-3 text-center">
                    <p className="text-sm text-red-500">{errors.form}</p>
                </div>
            )}
        </div>
    )
}
