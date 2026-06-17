import { DurableObject } from 'cloudflare:workers'
import { decode, encode } from '@msgpack/msgpack'

const DAY_DURATION = 24 * 60 * 60 * 1000
const MAX_CIRCUIT_SCORES = 10
const MAX_WHISPERS = 30
const MAX_TAG_LENGTH = 3
const MAX_MESSAGE_LENGTH = 30
const CATACLYSM_TARGET = 100

const toArrayBuffer = (bytes) =>
{
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

const pack = (data) =>
{
    return toArrayBuffer(encode(data))
}

const unpack = (message) =>
{
    if(typeof message === 'string')
        return JSON.parse(message)

    return decode(new Uint8Array(message))
}

const clamp = (value, min, max) =>
{
    return Math.min(max, Math.max(min, value))
}

const sanitizeTag = (value = '') =>
{
    return String(value).replace(/[^a-z]/gi, '').substring(0, MAX_TAG_LENGTH).toUpperCase()
}

const sanitizeCountryCode = (value = '') =>
{
    return String(value).replace(/[^a-z]/gi, '').substring(0, 2).toLowerCase()
}

const sanitizeMessage = (value = '') =>
{
    return String(value).trim().substring(0, MAX_MESSAGE_LENGTH)
}

const sanitizeNumber = (value, fallback = 0) =>
{
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

const json = (data, init = {}) =>
{
    return new Response(JSON.stringify(data, null, 2), {
        ...init,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            ...(init.headers ?? {}),
        },
    })
}

export class PortfolioRoom extends DurableObject
{
    constructor(ctx, env)
    {
        super(ctx, env)
        this.ctx = ctx
        this.env = env
    }

    async fetch(request)
    {
        if(request.headers.get('Upgrade') !== 'websocket')
            return json({ ok: false, error: 'Expected WebSocket upgrade' }, { status: 426 })

        const pair = new WebSocketPair()
        const [ client, server ] = Object.values(pair)

        this.ctx.acceptWebSocket(server)
        server.send(pack(await this.getInitData()))

        return new Response(null, { status: 101, webSocket: client })
    }

    async webSocketMessage(ws, message)
    {
        let data = null

        try
        {
            data = unpack(message)
        }
        catch(error)
        {
            ws.send(pack({ type: 'error', message: 'Invalid message payload' }))
            return
        }

        if(!data || typeof data.type !== 'string')
            return

        if(data.type === 'circuitInsert')
            await this.insertCircuitScore(data)
        else if(data.type === 'cookiesInsert')
            await this.insertCookies(data)
        else if(data.type === 'cataclysmInsert')
            await this.insertCataclysm()
        else if(data.type === 'whispersInsert')
            await this.insertWhisper(data)
    }

    webSocketClose(ws, code, reason)
    {
        ws.close(code, reason)
    }

    async getInitData()
    {
        const circuit = await this.getCircuitData()

        return {
            type: 'init',
            circuitResetTime: circuit.resetTime,
            circuitLeaderboard: circuit.scores,
            cookiesCount: await this.ctx.storage.get('cookiesCount') ?? 0,
            cataclysmCount: await this.ctx.storage.get('cataclysmCount') ?? 0,
            cataclysmProgress: await this.getCataclysmProgress(),
            cataclysmRunning: false,
            whispers: await this.ctx.storage.get('whispers') ?? [],
        }
    }

    async getCircuitData()
    {
        let resetTime = await this.ctx.storage.get('circuitResetTime')
        let scores = await this.ctx.storage.get('circuitScores')

        if(typeof resetTime !== 'number')
            resetTime = Date.now()

        if(!Array.isArray(scores))
            scores = []

        if(Date.now() - resetTime >= DAY_DURATION)
        {
            resetTime = Date.now()
            scores = []
            await this.ctx.storage.put({ circuitResetTime: resetTime, circuitScores: scores })
        }

        return { resetTime, scores }
    }

    async insertCircuitScore(data)
    {
        const tag = sanitizeTag(data.tag)
        const duration = Math.round(clamp(sanitizeNumber(data.duration), 1, 60 * 60 * 1000))

        if(tag.length !== MAX_TAG_LENGTH)
            return

        const circuit = await this.getCircuitData()
        const score = [
            tag,
            sanitizeCountryCode(data.countryCode),
            duration,
            String(data.uuid ?? ''),
            Date.now(),
            Array.isArray(data.checkpointTimings) ? data.checkpointTimings : [],
        ]

        const existingIndex = circuit.scores.findIndex((item) => item[3] === score[3] && item[0] === score[0])

        if(existingIndex !== -1)
        {
            if(circuit.scores[existingIndex][2] <= duration)
                return

            circuit.scores.splice(existingIndex, 1)
        }

        circuit.scores.push(score)
        circuit.scores.sort((a, b) => a[2] - b[2])
        circuit.scores = circuit.scores.slice(0, MAX_CIRCUIT_SCORES)

        await this.ctx.storage.put('circuitScores', circuit.scores)
        this.broadcast({ type: 'circuitUpdate', circuitLeaderboard: circuit.scores })
    }

    async insertCookies(data)
    {
        const amount = Math.round(clamp(sanitizeNumber(data.amount), 0, 1000))

        if(amount <= 0)
            return

        const current = await this.ctx.storage.get('cookiesCount') ?? 0
        const cookiesCount = current + amount

        await this.ctx.storage.put('cookiesCount', cookiesCount)
        this.broadcast({ type: 'cookiesUpdate', cookiesCount })
    }

    async insertCataclysm()
    {
        const cataclysmCount = (await this.ctx.storage.get('cataclysmCount') ?? 0) + 1
        await this.ctx.storage.put('cataclysmCount', cataclysmCount)

        this.broadcast({
            type: 'cataclysmUpdate',
            cataclysmCount,
            cataclysmProgress: await this.getCataclysmProgress(cataclysmCount),
            cataclysmRunning: false,
        })
    }

    async getCataclysmProgress(count = null)
    {
        const value = count ?? await this.ctx.storage.get('cataclysmCount') ?? 0
        return (value % CATACLYSM_TARGET) / CATACLYSM_TARGET
    }

    async insertWhisper(data)
    {
        const message = sanitizeMessage(data.message)

        if(!message)
            return

        const whispers = await this.ctx.storage.get('whispers') ?? []
        const whisper = {
            id: `${Date.now()}-${crypto.randomUUID()}`,
            message,
            countrycode: sanitizeCountryCode(data.countryCode),
            x: sanitizeNumber(data.x),
            y: sanitizeNumber(data.y),
            z: sanitizeNumber(data.z),
        }

        whispers.push(whisper)
        const deleted = whispers.splice(0, Math.max(0, whispers.length - MAX_WHISPERS))

        await this.ctx.storage.put('whispers', whispers)

        if(deleted.length)
            this.broadcast({ type: 'whispersDelete', whispers: deleted })

        this.broadcast({ type: 'whispersInsert', whispers: [ whisper ] })
    }

    broadcast(data)
    {
        const payload = pack(data)

        for(const socket of this.ctx.getWebSockets())
        {
            try
            {
                socket.send(payload)
            }
            catch(error)
            {
                socket.close(1011, 'Broadcast failed')
            }
        }
    }
}

export default {
    async fetch(request, env)
    {
        const url = new URL(request.url)

        if(request.method === 'OPTIONS')
        {
            return new Response(null, {
                status: 204,
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET, OPTIONS',
                    'access-control-allow-headers': 'content-type',
                },
            })
        }

        if(url.pathname === '/health')
            return json({ ok: true, service: 'allan-altarugio-portfolio-server' })

        if(url.pathname === '/ws')
        {
            const id = env.PORTFOLIO_ROOM.idFromName('global')
            return env.PORTFOLIO_ROOM.get(id).fetch(request)
        }

        return json({ ok: false, error: 'Not found' }, { status: 404 })
    },
}
