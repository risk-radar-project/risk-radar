import path from "path"

export type Variant = "master" | "thumb" | "preview" | "censored"

/** Two-level disk sharding: <uuid[0..1]>/<uuid[2..3]>/<uuid>_<variant>.jpg */
export function shardPath(mediaRoot: string, id: string, variant: Variant): string {
    const uuid = id.replace(/-/g, "")
    const a = uuid.slice(0, 2)
    const b = uuid.slice(2, 4)
    const file = `${id}_${variant}.jpg`
    return path.join(mediaRoot, a, b, file)
}
