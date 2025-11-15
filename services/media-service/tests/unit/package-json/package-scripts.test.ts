import { readFileSync } from "fs"
import path from "path"

const pkgPath = path.resolve(process.cwd(), "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    main?: string
    scripts?: Record<string, string>
}

describe("package scripts", () => {
    it("targets compiled server entry", () => {
        expect(pkg.main).toBe("dist/src/server.js")
        expect(pkg.scripts?.start).toBe("node dist/src/server.js")
    })

    it("targets compiled migrate entry", () => {
        expect(pkg.scripts?.migrate).toBe("node dist/src/db/migrate.js")
    })
})
