"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

export default function TermsPage() {
    const [activeSection, setActiveSection] = useState("postanowienia-ogolne")

    useEffect(() => {
        const handleScroll = () => {
            const sections = document.querySelectorAll("section[id]")
            let current = "postanowienia-ogolne"

            sections.forEach((section) => {
                const sectionTop = section.getBoundingClientRect().top
                if (sectionTop < 150) {
                    current = section.getAttribute("id") || current
                }
            })

            setActiveSection(current)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const navItems = [
        { id: "postanowienia-ogolne", label: "1. Postanowienia ogólne" },
        { id: "definicje", label: "2. Definicje" },
        { id: "konto", label: "3. Konto" },
        { id: "uslugi", label: "4. Usługi" },
        { id: "zasady-korzystania", label: "5. Zasady korzystania" },
        { id: "odpowiedzialnosc", label: "6. Odpowiedzialność" },
        { id: "reklamacje", label: "7. Reklamacje" },
        { id: "postanowienia-koncowe", label: "8. Postanowienia końcowe" }
    ]

    return (
        <>
            {/* Sidebar - hidden on mobile */}
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-800 bg-[#2a221a] p-6 lg:block">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Spis treści</h2>
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.id}
                            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                activeSection === item.id
                                    ? "bg-primary/20 text-primary"
                                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            }`}
                            href={`#${item.id}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-[#2a221a]">
                <div className="mx-auto max-w-4xl px-6 py-10 lg:px-12 lg:py-16 bg-[#2a221a]">
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold tracking-tight text-white">Regulamin</h1>
                        <p className="mt-2 text-zinc-500">Ostatnia aktualizacja: 16 Grudnia 2025</p>
                    </div>

                    <div className="space-y-12">
                        <section id="postanowienia-ogolne" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                1. Postanowienia ogólne
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Niniejszy regulamin określa zasady korzystania z aplikacji internetowej RiskRadar, dostępnej
                                pod adresem riskradar.pl. Administratorem aplikacji jest RiskRadar Sp. z o.o. z siedzibą w
                                Warszawie.
                            </p>
                        </section>

                        <section id="definicje" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                2. Definicje
                            </h2>
                            <ul className="list-disc space-y-3 pl-6 text-zinc-300">
                                <li>
                                    <strong className="text-white">Aplikacja</strong> - aplikacja internetowa RiskRadar.
                                </li>
                                <li>
                                    <strong className="text-white">Użytkownik</strong> - osoba fizyczna korzystająca z
                                    Aplikacji.
                                </li>
                                <li>
                                    <strong className="text-white">Konto</strong> - indywidualny panel Użytkownika w
                                    Aplikacji.
                                </li>
                            </ul>
                        </section>

                        <section id="konto" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                3. Konto
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Korzystanie z pełni funkcjonalności Aplikacji wymaga założenia Konta. Użytkownik zobowiązany
                                jest do podania prawdziwych danych podczas rejestracji. Użytkownik jest odpowiedzialny za
                                bezpieczeństwo swojego hasła.
                            </p>
                        </section>

                        <section id="uslugi" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                4. Usługi
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Aplikacja umożliwia wizualizację zgłoszonych zagrożeń na mapie miasta. Zgłoszenia mogą być
                                dodawane przez zarejestrowanych Użytkowników.
                            </p>
                        </section>

                        <section id="zasady-korzystania" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                5. Zasady korzystania
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Zabronione jest dodawanie treści niezgodnych z prawem, wulgarnych, obraźliwych oraz
                                wprowadzających w błąd. Administrator zastrzega sobie prawo do usuwania takich treści oraz
                                blokowania kont Użytkowników łamiących regulamin.
                            </p>
                        </section>

                        <section id="odpowiedzialnosc" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                6. Odpowiedzialność
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Administrator nie ponosi odpowiedzialności za treści zamieszczane przez Użytkowników.
                                Administrator dokłada wszelkich starań w celu zapewnienia poprawnego działania Aplikacji,
                                jednak nie ponosi odpowiedzialności za ewentualne przerwy w jej funkcjonowaniu.
                            </p>
                        </section>

                        <section id="reklamacje" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                7. Reklamacje
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Wszelkie reklamacje dotyczące działania Aplikacji należy zgłaszać na adres e-mail:{" "}
                                <a href="mailto:support@riskradar.pl" className="text-primary hover:underline">
                                    support@riskradar.pl
                                </a>
                                . Reklamacje będą rozpatrywane w terminie 14 dni roboczych.
                            </p>
                        </section>

                        <section id="postanowienia-koncowe" className="scroll-mt-20">
                            <h2 className="mb-4 border-b border-zinc-800 pb-3 text-2xl font-semibold text-white">
                                8. Postanowienia końcowe
                            </h2>
                            <p className="leading-relaxed text-zinc-300">
                                Administrator zastrzega sobie prawo do wprowadzania zmian w regulaminie. O wszelkich zmianach
                                Użytkownicy zostaną poinformowani drogą mailową. W sprawach nieuregulowanych niniejszym
                                regulaminem zastosowanie mają przepisy prawa polskiego.
                            </p>
                        </section>
                    </div>

                    {/* Back to top button */}
                    <div className="mt-16 flex justify-center border-t border-zinc-800 pt-8">
                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-primary"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="h-4 w-4"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                            Powrót na górę
                        </button>
                    </div>
                </div>
            </main>
        </>
    )
}
