"use client"

// This component provides the registration form for new users.
// It includes fields for username, email, and password, along with validation,
// a terms of service agreement, and submission handling.

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import { GATEWAY_URL } from "@/lib/auth/auth-service"

export default function RegisterPage() {
    // State for form data
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        terms: false
    })
    // State for validation errors
    const [errors, setErrors] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        terms: "",
        form: ""
    })
    // State for password visibility toggles
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false)

    // Check if the user is already logged in to disable the form.
    useEffect(() => {
        const checkToken = async () => {
            const token = localStorage.getItem("access_token")
            if (token) {
                try {
                    const { isTokenExpired } = await import("@/lib/auth/jwt-utils")
                    if (!isTokenExpired(token)) {
                        setIsAlreadyLoggedIn(true)
                    } else {
                        // Clear expired tokens
                        localStorage.removeItem("access_token")
                        localStorage.removeItem("refresh_token")
                    }
                } catch {
                    // Clear tokens if parsing fails
                    localStorage.removeItem("access_token")
                    localStorage.removeItem("refresh_token")
                }
            }
        }
        checkToken()
    }, [])

    // Handle changes in form inputs.
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
        // Clear the error for the field being edited.
        if (errors[id as keyof typeof errors]) {
            setErrors((prev) => ({ ...prev, [id]: "" }))
        }
    }

    // Clear the error for a specific field.
    const handleErrorReset = (field: string) => {
        setErrors((prev) => ({ ...prev, [field]: "" }))
    }

    // Handle form submission, including validation and API call.
    const handleSubmit = async () => {
        const newErrors = { username: "", email: "", password: "", confirmPassword: "", terms: "", form: "" }
        let isValid = true

        // Validate username
        if (!formData.username) {
            newErrors.username = "Username is required"
            isValid = false
        }

        // Validate email
        if (!formData.email) {
            newErrors.email = "Email is required"
            isValid = false
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Invalid email format"
            isValid = false
        }

        // Validate password complexity
        if (!formData.password) {
            newErrors.password = "Password is required"
            isValid = false
        } else {
            const hasUpperCase = /[A-Z]/.test(formData.password)
            const hasLowerCase = /[a-z]/.test(formData.password)
            const hasNumbers = /\d/.test(formData.password)
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
            const hasMinLength = formData.password.length >= 8

            if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
                newErrors.password = "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
                isValid = false
            }
        }

        // Validate password confirmation
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords must match"
            isValid = false
        }

        // Validate terms acceptance
        if (!formData.terms) {
            newErrors.terms = "You must accept the terms and conditions"
            isValid = false
        }

        setErrors(newErrors)

        if (isValid) {
            setIsLoading(true)
            try {
                const response = await fetch(`${GATEWAY_URL}/api/users/register`, {
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
                    // Redirect to login page on success with a parameter to show a message.
                    window.location.href = "/login?registered=true"
                } else {
                    setIsLoading(false)
                    // Handle specific error codes from the server.
                    if (response.status === 409) {
                        setErrors((prev) => ({
                            ...prev,
                            form: "A user with this username or email already exists."
                        }))
                    } else {
                        try {
                            const data = await response.json()
                            setErrors((prev) => ({ ...prev, form: data.error || "An error occurred during registration" }))
                        } catch {
                            setErrors((prev) => ({
                                ...prev,
                                form: "An error occurred during registration (Error parsing response)"
                            }))
                        }
                    }
                }
            } catch (error) {
                setIsLoading(false)
                console.error("Registration error:", error)
                setErrors((prev) => ({ ...prev, form: "Connection error with the server. Please check if the server is running." }))
            }
        }
    }
    return (
        <div className="mt-6 w-full">
            <div className="flex w-full flex-col items-center">
                <h1 className="tracking-light pt-6 pb-3 text-center text-[32px] leading-tight font-bold text-white">
                    RiskRadar
                </h1>
                <p className="px-4 pt-1 pb-3 text-center text-base leading-normal font-normal text-zinc-400 dark:text-white">
                    Log in or Create an account to get started.
                </p>
            </div>
            <div className="pb-3">
                <div className="flex justify-between border-b border-[#54473b]">
                    <Link
                        className="flex flex-1 flex-col items-center justify-center border-b-[3px] border-b-transparent pt-4 pb-[13px] text-[#baab9c]"
                        href="/login"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-[#baab9c]">Login</p>
                    </Link>
                    <Link
                        className={`border-b-primary flex flex-1 flex-col items-center justify-center border-b-[3px] pt-4 pb-[13px] text-white ${isAlreadyLoggedIn ? "pointer-events-none opacity-50" : ""}`}
                        href="/register"
                    >
                        <p className="text-sm leading-normal font-bold tracking-[0.015em] text-white">Register</p>
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
                        Username
                    </Label>
                    <Input
                        className={`form-input focus:ring-primary/50 flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border text-white focus:ring-2 focus:outline-0 ${
                            errors.username ? "border-red-500 focus:border-red-500" : "focus:border-primary border-[#54473b]"
                        } h-14 bg-[#27211b] p-[15px] text-base leading-normal font-normal placeholder:text-[#baab9c]`}
                        id="username"
                        placeholder="JohnDoe"
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
                        placeholder="john.doe@example.com"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={isLoading}
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>
                <div className="flex w-full flex-col">
                    <Label className="pb-2 text-base leading-normal font-medium text-white" htmlFor="password">
                        Password
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
                            placeholder="Enter your password"
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
                        Confirm Password
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
                            placeholder="Enter your password again"
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
                        I accept the{" "}
                        <Link href="/terms" className="hover:text-primary font-semibold text-white hover:underline">
                            terms and conditions
                        </Link>
                    </Label>
                </div>
                {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}
                {errors.form && <p className="text-center text-sm text-red-500">{errors.form}</p>}
                <Button
                    type="submit"
                    className="flex h-14 w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 focus:ring-offset-[#1a1410] focus:outline-none"
                    disabled={isLoading || isAlreadyLoggedIn}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                            <span>Processing...</span>
                        </div>
                    ) : (
                        "Register"
                    )}
                </Button>
            </form>
        </div>
    )
}
