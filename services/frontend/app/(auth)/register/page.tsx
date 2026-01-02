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
      </div>
    </div>
  );
}

