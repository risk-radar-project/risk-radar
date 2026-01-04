"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({
    username: "",
    password: "",
    form: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Import isTokenExpired dynamically to avoid issues
    const checkToken = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        // Check if token is valid by trying to parse it
        try {
          const { isTokenExpired } = await import("@/lib/auth/jwt-utils");
          if (!isTokenExpired(token)) {
            setIsAlreadyLoggedIn(true);
          } else {
            // Token is expired, clear it so user can log in
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
          }
        } catch (e) {
          // If there's an error parsing, clear the token
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccessMessage("Rejestracja zakończona sukcesem. Możesz się teraz zalogować.");
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleSubmit = async () => {
    let newErrors = { username: "", password: "", form: "" };
    let isValid = true;

    if (!formData.username) {
      newErrors.username = "Nazwa użytkownika lub email jest wymagany";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Hasło jest wymagane";
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      setIsLoading(true);
      try {
        const response = await fetch("http://localhost:8090/api/users/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Store tokens in localStorage (support both camelCase and snake_case)
          const accessToken = data.accessToken || data.access_token || data.token;
          const refreshToken = data.refreshToken || data.refresh_token;

          if (accessToken) localStorage.setItem("access_token", accessToken);
          if (refreshToken) localStorage.setItem("refresh_token", refreshToken);

          setSuccessMessage("Pomyślnie zalogowano! Trwa przekierowanie...");

          // Delay redirect to show success message and simple loader
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);

        } else {
          setIsLoading(false);
          let data = null;
          try {
            data = await response.json();
          } catch (e) {
            console.warn("Failed to parse error response JSON", e);
          }

          if (response.status === 401) {
            setErrors((prev) => ({ ...prev, form: "Nieprawidłowa nazwa użytkownika lub hasło" }));
          } else {
            const errorMessage = data && typeof data.error === 'string'
              ? data.error
              : (data && data.message ? String(data.message) : "Wystąpił błąd podczas logowania");

            setErrors((prev) => ({ ...prev, form: errorMessage }));
          }
        }
      } catch (error) {
        setIsLoading(false);
        console.error("Login error:", error);
        setErrors((prev) => ({ ...prev, form: "Błąd połączenia z serwerem" }));
      }
    }
  };

  if (isLoading && successMessage) {
    return (
      <div className="w-full mt-6 flex flex-col items-center justify-center min-h-[300px] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium text-green-500">{successMessage}</p>
      </div>
    )
  }

  return (
    <div className="w-full mt-6">
      {successMessage && !isLoading && (
        <div className="mb-4 p-4 text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
          {successMessage}
        </div>
      )}
      <div className="pb-3">
        <div className="flex border-b border-[#54473b] justify-between">
          <Link
            className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-white pb-[13px] pt-4 flex-1"
            href="/login"
          >
            <p className="text-white text-sm font-bold leading-normal tracking-[0.015em]">
              Logowanie
            </p>
          </Link>
          <Link
            className={`flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#baab9c] pb-[13px] pt-4 flex-1 ${isAlreadyLoggedIn ? 'pointer-events-none opacity-50' : ''}`}
            href="/register"
          >
            <p className="text-[#baab9c] text-sm font-bold leading-normal tracking-[0.015em]">
              Rejestracja
            </p>
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-4 py-3">
        <div className="flex flex-col w-full">
          <Label
            className="text-white text-base font-medium leading-normal pb-2"
            htmlFor="username"
          >
            Email lub login
          </Label>
          <Input
            className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border ${errors.username ? "border-red-500 focus:border-red-500" : "border-[#54473b] focus:border-primary"
              } bg-[#27211b] h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal`}
            id="username"
            placeholder="jan.kowalski@example.com lub janek"
            type="text"
            value={formData.username}
            onChange={handleInputChange}
            disabled={isLoading || isAlreadyLoggedIn}
          />
          {errors.username && (
            <p className="text-red-500 text-sm mt-1">{errors.username}</p>
          )}
        </div>
        <div className="flex flex-col w-full">
          <Label
            className="text-white text-base font-medium leading-normal pb-2"
            htmlFor="password"
          >
            Hasło
          </Label>
          <div className={`flex w-full flex-1 items-center rounded-lg border ${errors.password ? "border-red-500 focus-within:border-red-500" : "border-[#54473b] focus-within:border-primary"
            } bg-[#27211b] focus-within:ring-2 focus-within:ring-primary/50 h-14 overflow-hidden`}>
            <Input
              className="form-input flex w-full min-w-0 flex-1 resize-none border-0 bg-transparent text-white placeholder:text-[#baab9c] focus-visible:ring-0 focus-visible:ring-offset-0 h-full p-[15px] pr-2 text-base font-normal leading-normal rounded-none shadow-none"
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
              className="h-full text-[#baab9c] flex items-center justify-center px-[15px] hover:text-white bg-transparent border-0 hover:bg-transparent focus:ring-0 rounded-none shadow-none"
              disabled={isLoading || isAlreadyLoggedIn}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Checkbox
            className="form-checkbox h-4 w-4 rounded border-[#54473b] bg-[#27211b] text-primary focus:ring-primary"
            id="remember-me"
            checked={formData.rememberMe}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, rememberMe: checked === true }))
            }
            disabled={isLoading || isAlreadyLoggedIn}
          />
          <Label className="text-sm text-[#baab9c]" htmlFor="remember-me">
            Zapamiętaj mnie
          </Label>
        </div>
        <Link className="text-sm text-white hover:underline" href="#">
          Nie pamiętasz hasła?
        </Link>
      </div>
      <div className="flex flex-col gap-4 py-3">
        <Button
          onClick={handleSubmit}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark"
          disabled={isLoading || isAlreadyLoggedIn}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              <span>Logowanie...</span>
            </div>
          ) : isAlreadyLoggedIn ? "Jesteś już zalogowany" : "Zaloguj się"}
        </Button>

      </div>
      {errors.form && (
        <div className="pb-3 text-center">
          <p className="text-red-500 text-sm">{errors.form}</p>
        </div>
      )}
    </div>
  );
}
