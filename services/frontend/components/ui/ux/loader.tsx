"use client"

import { Spinner } from "./spinner"

export function Loader() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <Spinner />
        </div>
    )
}
