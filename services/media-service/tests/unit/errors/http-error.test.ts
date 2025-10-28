import { errors } from "../../../src/errors/http-error"

describe("http-error factories", () => {
    test("validation produces 400", () => {
        const e = errors.validation("x")
        expect(e.status).toBe(400)
        expect(e.code).toBe("VALIDATION_ERROR")
    })

    test("notFound sets status 404", () => {
        const e = errors.notFound()
        expect(e.status).toBe(404)
        expect(e.code).toBe("NOT_FOUND")
    })

    test("forbidden sets status 403", () => {
        const e = errors.forbidden()
        expect(e.status).toBe(403)
        expect(e.code).toBe("FORBIDDEN")
    })

    test("internal defaults to 500", () => {
        const e = errors.internal()
        expect(e.status).toBe(500)
        expect(e.code).toBe("INTERNAL_ERROR")
    })
})
