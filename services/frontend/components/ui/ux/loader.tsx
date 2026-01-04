"use client"

import { Spinner } from "./spinner"

export function Loader() {
    return (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
            <Spinner />
        </div>
    )
}
