"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset, confirmPasswordReset } from "@/lib/api/user"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"

function ResetPasswordContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get("token")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState({ type: "", text: "" })

    // Mode: "request" (enter email) or "reset" (enter new password)
    const mode = token ? "reset" : "request"

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsLoading(true)
        setMessage({ type: "", text: "" })

        try {
            const result = await requestPasswordReset(email)
            if (result.error) {
                setMessage({ type: "error", text: result.error })
            } else {
                setMessage({
                    type: "success",
                    text: result.data?.message || "Jeśli podany email istnieje, wysłaliśmy link resetujący."
                })
            }
        } catch (error) {
            setMessage({ type: "error", text: "Wystąpił błąd." })
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Hasła nie są identyczne" })
            return
        }
        if (password.length < 6) {
            setMessage({ type: "error", text: "Hasło musi mieć co najmniej 6 znaków" })
            return
        }

        setIsLoading(true)
        setMessage({ type: "", text: "" })

        try {
            const result = await confirmPasswordReset(token!, password)
            if (result.error) {
                setMessage({ type: "error", text: result.error })
            } else {
                setMessage({ type: "success", text: "Hasło zostało zmienione. Przekierowanie..." })
                setTimeout(() => {
                    router.push("/login")
                }, 2000)
            }
        } catch (error) {
            setMessage({ type: "error", text: "Wystąpił błąd." })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="mt-6 w-full">
            <div className="mb-6">
                <Link href="/login" className="flex items-center text-sm text-[#baab9c] hover:text-white transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Powrót do logowania
                </Link>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">
                    {mode === "request" ? "Reset hasła" : "Ustaw nowe hasło"}
                </h1>
                <p className="text-[#baab9c]">
                    {mode === "request"
                        ? "Wprowadź swój adres email, aby otrzymać link do zmiany hasła."
                        : "Wprowadź nowe hasło dla swojego konta."}
                </p>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-lg border text-sm ${message.type === "success"
                        ? "border-green-500/20 bg-green-500/10 text-green-500"
                        : "border-red-500/20 bg-red-500/10 text-red-500"
                    }`}>
                    {message.text}
                </div>
            )}

            {mode === "request" ? (
                <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
                    <div className="flex w-full flex-col">
                        <Label className="pb-2 text-base font-medium text-white" htmlFor="email">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="jan.kowalski@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-14 bg-[#27211b] border-[#54473b] text-white placeholder:text-[#baab9c] focus:border-primary"
                            disabled={isLoading || (message.type === "success")}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="h-14 w-full bg-primary text-white font-bold text-base hover:bg-primary/90 mt-2"
                        disabled={isLoading || (message.type === "success")}
                    >
                        {isLoading ? "Wysyłanie..." : "Wyślij link"}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
                    <div className="flex w-full flex-col">
                        <Label className="pb-2 text-base font-medium text-white" htmlFor="password">
                            Nowe hasło
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Minimum 6 znaków"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-14 bg-[#27211b] border-[#54473b] text-white placeholder:text-[#baab9c] focus:border-primary pr-10"
                                disabled={isLoading}
                                required
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 text-[#baab9c] hover:text-white hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                    <div className="flex w-full flex-col">
                        <Label className="pb-2 text-base font-medium text-white" htmlFor="confirmPassword">
                            Powtórz hasło
                        </Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Powtórz nowe hasło"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-14 bg-[#27211b] border-[#54473b] text-white placeholder:text-[#baab9c] focus:border-primary"
                            disabled={isLoading}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="h-14 w-full bg-primary text-white font-bold text-base hover:bg-primary/90 mt-2"
                        disabled={isLoading}
                    >
                        {isLoading ? "Zapisywanie..." : "Zmień hasło"}
                    </Button>
                </form>
            )}
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="text-white text-center mt-10">Ładowanie...</div>}>
            <ResetPasswordContent />
        </Suspense>
    )
}
