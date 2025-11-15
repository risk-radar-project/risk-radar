process.env.NODE_ENV = "test"
process.env.HOSTNAME = "authz.local"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"
process.env.GC_ENABLED = "false"
process.env.MODERATION_ENABLED = "false"

// Mock external HTTP with jest mocks (axios)
import axios from "axios"
jest.mock("axios")
;(axios.post as any).mockResolvedValue({ data: { results: [{ flagged: false }] } })
;(axios.get as any).mockResolvedValue({ data: { has_permission: true } })
