import { CircuitBreaker } from "../../../src/domain/circuit-breaker"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe("CircuitBreaker", () => {
    test("opens after threshold failures and blocks calls", async () => {
        const br = new CircuitBreaker({ name: "x", failureThreshold: 2, halfOpenAfterMs: 50, resetAfterMs: 50 })
        await expect(
            br.exec(async () => {
                throw new Error("fail")
            })
        ).rejects.toThrow("fail")
        await expect(
            br.exec(async () => {
                throw new Error("fail")
            })
        ).rejects.toThrow("fail")
        // now open
        await expect(br.exec(async () => "ok")).rejects.toThrow(/circuit_open:x/)
    })

    test("half-open after cooldown then success closes", async () => {
        const br = new CircuitBreaker({ name: "y", failureThreshold: 1, halfOpenAfterMs: 30, resetAfterMs: 30 })
        await expect(
            br.exec(async () => {
                throw new Error("boom")
            })
        ).rejects.toThrow("boom")
        await expect(br.exec(async () => "still blocked")).rejects.toThrow(/circuit_open:y/)
        await sleep(35)
        const val = await br.exec(async () => "recovered")
        expect(val).toBe("recovered")
        // subsequent call succeeds without reopening
        const val2 = await br.exec(async () => "recovered2")
        expect(val2).toBe("recovered2")
    })

    test("failure during half-open resets to open", async () => {
        const br = new CircuitBreaker({ name: "z", failureThreshold: 1, halfOpenAfterMs: 20, resetAfterMs: 20 })
        await expect(
            br.exec(async () => {
                throw new Error("x")
            })
        ).rejects.toThrow("x")
        await sleep(25)
        // first probe fails -> stays open
        await expect(
            br.exec(async () => {
                throw new Error("again")
            })
        ).rejects.toThrow("again")
        // immediate next call blocked
        await expect(br.exec(async () => "no")).rejects.toThrow(/circuit_open:z/)
    })
})
