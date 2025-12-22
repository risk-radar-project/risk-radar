import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="w-full mt-6">
      <div className="pb-3">
        <div className="flex border-b border-[#54473b] justify-between">
          <Link
            className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#baab9c] pb-[13px] pt-4 flex-1"
            href="/login"
          >
            <p className="text-[#baab9c] text-sm font-bold leading-normal tracking-[0.015em]">
              Logowanie
            </p>
          </Link>
          <Link
            className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-white pb-[13px] pt-4 flex-1"
            href="/register"
          >
            <p className="text-white text-sm font-bold leading-normal tracking-[0.015em]">
              Rejestracja
            </p>
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-4 py-3">
        <div className="flex flex-col w-full">
          <Label
            className="text-white text-base font-medium leading-normal pb-2"
            htmlFor="email"
          >
            Email
          </Label>
          <Input
            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#54473b] bg-[#27211b] focus:border-primary h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal"
            id="email"
            placeholder="jan.kowalski@example.com"
            type="email"
          />
        </div>
        <div className="flex flex-col w-full">
          <Label
            className="text-white text-base font-medium leading-normal pb-2"
            htmlFor="password"
          >
            Hasło
          </Label>
          <div className="flex w-full flex-1 items-stretch rounded-lg">
            <Input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#54473b] bg-[#27211b] focus:border-primary h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal"
              id="password"
              placeholder="Wpisz swoje hasło"
              type="password"
            />
          </div>
        </div>
        <div className="flex flex-col w-full">
          <Label
            className="text-white text-base font-medium leading-normal pb-2"
            htmlFor="confirm-password"
          >
            Potwierdź hasło
          </Label>
          <div className="flex w-full flex-1 items-stretch rounded-lg">
            <Input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#54473b] bg-[#27211b] focus:border-primary h-14 placeholder:text-[#baab9c] p-[15px] text-base font-normal leading-normal"
              id="confirm-password"
              placeholder="Wpisz hasło ponownie"
              type="password"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label
            htmlFor="terms"
            className="text-sm font-medium leading-none text-zinc-400"
          >
            Akceptuję {" "}
            <Link href="/terms" className="text-white font-semibold hover:text-primary hover:underline">
              regulamin
            </Link>
          </Label>
        </div>
      </div>
      <div className="flex flex-col gap-4 pt-3 pb-3">
        <Button className="flex h-14 w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark">
          Zarejestruj się
        </Button>
        <div className="relative flex items-center justify-center py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#54473b]"></div>
          </div>
          <div className="relative bg-[#181411] px-4 text-sm text-[#baab9c]">
            Lub zarejestruj się przez
          </div>
        </div>
        <Button
          variant="outline"
          className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-[#54473b] bg-transparent px-6 text-base font-medium text-white shadow-sm hover:bg-[#27211b] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.578 12.27c0-.79-.07-1.54-.2-2.27H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.73 3.28-8.07z"
              fill="#4285F4"
            ></path>
            <path
              d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.57-2.77c-1.08.73-2.45 1.16-4.36 1.16-3.37 0-6.23-2.28-7.25-5.33H1.07v2.87C3.06 20.25 7.22 23 12 23z"
              fill="#34A853"
            ></path>
            <path
              d="M4.75 13.54c-.19-.57-.3-1.18-.3-1.81s.11-1.24.3-1.81V7.05H1.07A10.99 10.99 0 000 11.73c0 1.62.36 3.16 1.07 4.54l3.68-2.74z"
              fill="#FBBC05"
            ></path>
            <path
              d="M12 4.28c1.77 0 3.35.61 4.62 1.83l3.15-3.15C17.95.88 15.24 0 12 0 7.22 0 3.06 2.75 1.07 7.05l3.68 2.87c1.02-3.05 3.88-5.33 7.25-5.33z"
              fill="#EA4335"
            ></path>
          </svg>
          Kontynuuj z Google
        </Button>
      </div>
    </div>
  );
}

