/**
 * server.ts — Custom Next.js server with WebSocket support
 *
 * This server intercepts WebSocket upgrade requests for Twilio Media Stream
 * bridge endpoints and delegates them to the realtime bridge.
 *
 * Start with: node server.js (after `next build`)
 * Or in dev: ts-node server.ts (requires ts-node)
 */

import { createServer, IncomingMessage } from 'http'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import { parse } from 'url'
import { createRealtimeBridge, type BridgeParams } from './lib/realtimeBridge'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true)
    handle(req, res, parsedUrl)
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const { pathname, query } = parse(req.url || '/', true)

    if (pathname === '/api/calls/enroll/stream') {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const params: BridgeParams = {
          role: 'enroll',
          patientId: (query.patientId as string) || '',
          patientName: (query.patientName as string) || '',
          caregiverName: (query.caregiverName as string) || '',
        }
        createRealtimeBridge(ws, params, appUrl)
      })
    } else if (pathname === '/api/calls/remind/stream') {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        let medList: Array<{ name: string; nickname: string | null; dosage: string | null }> = []
        try {
          medList = JSON.parse(decodeURIComponent((query.medList as string) || '[]'))
        } catch { /* ignore parse error */ }

        const params: BridgeParams = {
          role: 'remind',
          escalationId: (query.escalationId as string) || '',
          patientName: (query.patientName as string) || '',
          medList,
        }
        createRealtimeBridge(ws, params, appUrl)
      })
    } else {
      // Not a recognized WebSocket path — destroy the socket
      socket.destroy()
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
