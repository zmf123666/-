import { useEffect, useRef, useState } from "react"

type BirdType = "red" | "gold" | "bomb"
const birds = {
  red: {
    name: "赤羽",
    color: "#eb6040",
    skill: "强力撞击",
    hint: "撞击力更强，适合推倒高塔",
    speed: 1,
    power: 1.7,
  },
  gold: {
    name: "疾风",
    color: "#e6ac32",
    skill: "空中加速",
    hint: "飞行时点击场景或按空格，加速穿透",
    speed: 1,
    power: 1,
  },
  bomb: {
    name: "黑曜",
    color: "#485367",
    skill: "范围爆破",
    hint: "撞击自动爆炸，也可点击或按空格引爆",
    speed: 0.9,
    power: 1.2,
  },
}
const levels = [
  "绿野初试",
  "双塔守卫",
  "石墙阵线",
  "高空危机",
  "三塔连营",
  "重甲堡垒",
  "交错防线",
  "终极要塞",
]
const lineup: BirdType[] = ["red", "gold", "bomb", "red"]
type Body = {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  kind: "wood" | "stone" | "pig"
  alive: boolean
  hp: number
  hitAt: number
}
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}
type Game = {
  bodies: Body[]
  bird: { x: number y: number vx: number vy: number }
  type: BirdType
  used: boolean
  skillRequested: boolean
  blast: number
  blastX: number
  blastY: number
  dragging: boolean
  flying: boolean
  shots: number
  score: number
  ticks: number
  trail: { x: number y: number }[]
  particles: Particle[]
  result: string
}
const W = 1200,
  H = 550,
  ground = 440,
  anchor = { x: 235, y: 340 }
function setup(level: number): Game {
  const bodies: Body[] = []
  const add = (
    x: number,
    y: number,
    w: number,
    h: number,
    kind: Body["kind"] = "wood",
  ) =>
    bodies.push({
      x,
      y,
      w,
      h,
      vx: 0,
      vy: 0,
      kind,
      alive: true,
      hp: kind === "stone" ? 3 : 1,
      hitAt: -100,
    })
  function tower(x: number, floors: number, stone = false) {
    for (let i = 0; i < floors; i++) {
      const floor = ground - i * 96
      const material = stone && i === 0 ? "stone" : "wood"
      add(x - 57, floor - 42, 20, 84, material)
      add(x + 57, floor - 42, 20, 84, material)
      add(x, floor - 90, 146, 12, stone && i === 1 ? "stone" : "wood")
      add(x, floor - 23, 42, 42, "pig")
    }
    add(x, ground - floors * 96 - 23, 42, 42, "pig")
  }
  if (level === 1) tower(897, 2)
  if (level === 2) {
    tower(790, 2)
    tower(1050, 1)
  }
  if (level === 3) {
    tower(865, 2, true)
    add(1080, 419, 42, 42, "pig")
    add(1015, 402, 24, 76, "stone")
  }
  if (level === 4) {
    tower(790, 3)
    tower(1060, 2)
  }
  if (level === 5) {
    tower(670, 1)
    tower(880, 2)
    tower(1090, 1)
  }
  if (level === 6) {
    tower(790, 2, true)
    tower(1050, 2, true)
  }
  if (level === 7) {
    tower(670, 2)
    tower(880, 3, true)
    tower(1090, 1, true)
  }
  if (level === 8) {
    tower(670, 3, true)
    tower(880, 2, true)
    tower(1090, 3, true)
  }
  return {
    bodies,
    bird: { ...anchor, vx: 0, vy: 0 },
    type: "red",
    used: false,
    skillRequested: false,
    blast: 0,
    blastX: 0,
    blastY: 0,
    dragging: false,
    flying: false,
    shots: 4,
    score: 0,
    ticks: 0,
    trail: [],
    particles: [],
    result: "",
  }
}
function Icon({ name, size = 20 }: { name: string size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 2 9" />
        <path d="M3 4v6h6" />
      </>
    ),
    sound: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5z" />
        <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5z" />
        <path d="m16 9 6 6m0-6-6 6" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
function birdArt(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r = 22,
  type: BirdType = "red",
) {
  c.save()
  c.translate(x, y)
  c.fillStyle = "#c4442d"
  c.beginPath()
  c.moveTo(-r + 2, 4)
  c.lineTo(-r - 12, -4)
  c.lineTo(-r - 9, 9)
  c.closePath()
  c.fill()
  c.fillStyle = birds[type].color
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = "#fff0d2"
  c.beginPath()
  c.ellipse(1, r * 0.65, r * 0.65, r * 0.35, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = birds[type].color
  c.beginPath()
  c.moveTo(-7, -r + 2)
  c.lineTo(-11, -r - 11)
  c.lineTo(-2, -r - 5)
  c.lineTo(5, -r - 10)
  c.lineTo(8, -r + 4)
  c.fill()
  c.fillStyle = "white"
  c.beginPath()
  c.ellipse(8, -3, 7, 8, 0, 0, 7)
  c.fill()
  c.fillStyle = "#263a2d"
  c.beginPath()
  c.arc(11, -2, 2.6, 0, 7)
  c.fill()
  c.strokeStyle = "#433e2b"
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(1, -12)
  c.lineTo(15, -8)
  c.stroke()
  c.fillStyle = "#f8b73f"
  c.beginPath()
  c.moveTo(15, 0)
  c.lineTo(30, 5)
  c.lineTo(15, 10)
  c.fill()
  c.restore()
}
function pigArt(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = "#91b955"
  c.beginPath()
  c.arc(x - r * 0.55, y - r * 0.75, r * 0.3, 0, 7)
  c.arc(x + r * 0.55, y - r * 0.75, r * 0.3, 0, 7)
  c.fill()
  c.beginPath()
  c.arc(x, y, r, 0, 7)
  c.fill()
  c.fillStyle = "#fffbee"
  for (const dx of [-8, 8]) {
    c.beginPath()
    c.arc(x + dx, y - 5, 5.5, 0, 7)
    c.fill()
  }
  c.fillStyle = "#34472a"
  for (const dx of [-7, 7]) {
    c.beginPath()
    c.arc(x + dx, y - 4, 2, 0, 7)
    c.fill()
  }
  c.fillStyle = "#b8d47e"
  c.beginPath()
  c.ellipse(x, y + 7, 12, 8, 0, 0, 7)
  c.fill()
  c.fillStyle = "#587e39"
  for (const dx of [-4, 4]) {
    c.beginPath()
    c.ellipse(x + dx, y + 7, 2, 3, 0, 0, 7)
    c.fill()
  }
}
export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game>(setup(1))
  const [level, setLevel] = useState(1)
  const [hud, setHud] = useState({
    shots: 4,
    score: 0,
    pigs: 3,
    result: "",
    type: "red" as BirdType,
    flying: false,
    used: false,
  })
  const [muted, setMuted] = useState(true)
  const [help, setHelp] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const muteRef = useRef(muted)
  muteRef.current = muted
  function tone(freq: number) {
    if (muteRef.current) return
    try {
      const a = (audio.current ||= new AudioContext())
      void a.resume()
      const o = a.createOscillator(),
        gain = a.createGain()
      o.connect(gain)
      gain.connect(a.destination)
      o.frequency.setValueAtTime(freq, a.currentTime)
      o.frequency.exponentialRampToValueAtTime(freq / 2, a.currentTime + 0.15)
      gain.gain.setValueAtTime(0.08, a.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.2)
      o.start()
      o.stop(a.currentTime + 0.2)
    } catch {
      /* Audio is optional. */
    }
  }
  function reset(l = level) {
    game.current = setup(l)
    setLevel(l)
    setHud({
      shots: 4,
      score: 0,
      pigs: game.current.bodies.filter((b) => b.kind === "pig").length,
      result: "",
      type: "red",
      flying: false,
      used: false,
    })
  }
  function activate() {
    const g = game.current
    if (g.flying && !g.used && !g.result) g.skillRequested = true
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        activate()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  useEffect(() => {
    const c = canvas.current!.getContext("2d")!
    let frame: number,
      last = 0,
      accumulator = 0
    function burst(x: number, y: number, color: string) {
      for (let i = 0; i < 12; i++)
        game.current.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 7,
          life: 38,
          color,
        })
    }
    function tick() {
      const g = game.current
      if (g.blast > 0) g.blast--
      function explode() {
        g.used = true
        g.blast = 30
        g.blastX = g.bird.x
        g.blastY = g.bird.y
        tone(150)
        burst(g.bird.x, g.bird.y, "#efab45")
        for (const b of g.bodies)
          if (b.alive && Math.hypot(b.x - g.bird.x, b.y - g.bird.y) < 155) {
            b.alive = false
            g.score += b.kind === "pig" ? 1000 : 200
            burst(b.x, b.y, b.kind === "pig" ? "#9dbb64" : "#c1a380")
          }
        g.bird.vx *= 0.2
        g.bird.vy *= 0.2
      }
      if (g.flying && !g.result) {
        if (g.skillRequested && !g.used) {
          if (g.type === "bomb") explode()
          if (g.type === "gold") {
            g.bird.vx *= 1.75
            g.bird.vy *= 0.65
            g.used = true
            tone(900)
            burst(g.bird.x, g.bird.y, "#f1bc45")
          }
        }
        g.skillRequested = false
        g.ticks++
        g.bird.vy += 0.19
        g.bird.x += g.bird.vx
        g.bird.y += g.bird.vy
        if (g.ticks % 5 === 0) g.trail.push({ x: g.bird.x, y: g.bird.y })
        for (const b of g.bodies) {
          if (!b.alive) continue
          const dx =
            g.bird.x -
            Math.max(b.x - b.w / 2, Math.min(g.bird.x, b.x + b.w / 2))
          const dy =
            g.bird.y -
            Math.max(b.y - b.h / 2, Math.min(g.bird.y, b.y + b.h / 2))
          if (
            dx * dx + dy * dy < 25 * 25 &&
            Math.hypot(g.bird.vx, g.bird.vy) > 1.2 &&
            g.ticks - b.hitAt > 12
          ) {
            b.hitAt = g.ticks
            if (g.type === "bomb" && !g.used) {
              explode()
              break
            }
            if (b.kind === "pig") {
              b.alive = false
              g.score += 1000
              burst(b.x, b.y, "#9dbb64")
              tone(520)
            } else {
              const power =
                birds[g.type].power * (g.type === "gold" && g.used ? 2 : 1)
              b.hp -= power
              b.vx += g.bird.vx * (b.kind === "stone" ? 0.18 : 0.45) * power
              b.vy -= 2
              if (b.hp <= 0) {
                b.alive = false
                g.score += b.kind === "stone" ? 300 : 100
              }
              g.bird.vx *= b.kind === "stone" ? 0.55 : 0.85
              burst(b.x, b.y, b.kind === "stone" ? "#8a99a2" : "#d1a267")
            }
          }
        }
        if (g.bird.y > ground - 20) {
          g.bird.y = ground - 20
          g.bird.vy *= -0.38
          g.bird.vx *= 0.8
        }
      }
      for (const b of g.bodies) {
        if (!b.alive) continue
        b.vy += 0.19
        b.x += b.vx
        b.y += b.vy
        b.vx *= 0.98
        let floor = ground
        for (const other of g.bodies)
          if (
            other !== b &&
            other.alive &&
            other.kind !== "pig" &&
            Math.abs(b.x - other.x) < (b.w + other.w) / 2 - 3 &&
            b.y < other.y &&
            b.y + b.h / 2 - b.vy <= other.y - other.h / 2 + 2
          )
            floor = Math.min(floor, other.y - other.h / 2)
        if (b.y + b.h / 2 >= floor) {
          if (b.kind === "pig" && b.vy > 3) {
            b.alive = false
            g.score += 1000
            burst(b.x, b.y, "#9dbb64")
            tone(420)
          }
          b.y = floor - b.h / 2
          b.vy = 0
        }
        if (b.x > W + 50 || b.x < -50) b.alive = false
      }
      g.particles = g.particles.filter((p) => p.life-- > 0)
      for (const p of g.particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.16
      }
      const pigs = g.bodies.filter((b) => b.alive && b.kind === "pig").length
      if (!pigs) g.result = "win"
      if (
        g.flying &&
        (g.ticks > 360 ||
          g.bird.x > W + 50 ||
          g.bird.x < -80 ||
          (g.ticks > 90 && Math.abs(g.bird.vx) < 0.2))
      ) {
        g.flying = false
        if (g.shots > 0) {
          g.bird = { ...anchor, vx: 0, vy: 0 }
          g.type = lineup[4 - g.shots]
          g.used = false
        } else if (pigs && !g.result) g.result = "lose"
      }
      setHud((prev) =>
        prev.shots === g.shots &&
        prev.score === g.score &&
        prev.pigs === pigs &&
        prev.result === g.result &&
        prev.type === g.type &&
        prev.flying === g.flying &&
        prev.used === g.used
          ? prev
          : {
              shots: g.shots,
              score: g.score,
              pigs,
              result: g.result,
              type: g.type,
              flying: g.flying,
              used: g.used,
            },
      )
    }
    function draw(now: number) {
      accumulator += Math.min(now - (last || now), 50)
      last = now
      while (accumulator >= 16.67) {
        tick()
        accumulator -= 16.67
      }
      const g = game.current
      c.clearRect(0, 0, W, H)
      const sky = c.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, "#e4f0eb")
      sky.addColorStop(1, "#f4f4df")
      c.fillStyle = sky
      c.fillRect(0, 0, W, H)
      c.fillStyle = "#f9f7dd"
      c.beginPath()
      c.arc(1010, 93, 47, 0, 7)
      c.fill()
      c.fillStyle = "#ffffff90"
      for (const [x, y, s] of [
        [150, 95, 1],
        [520, 65, 0.8],
        [710, 150, 0.65],
      ]) {
        c.beginPath()
        c.ellipse(x, y, 52 * s, 15 * s, 0, 0, 7)
        c.ellipse(x - 19 * s, y - 9 * s, 23 * s, 20 * s, 0, 0, 7)
        c.ellipse(x + 12 * s, y - 15 * s, 30 * s, 24 * s, 0, 0, 7)
        c.fill()
      }
      c.fillStyle = "#d3e1cc"
      c.beginPath()
      c.moveTo(0, 365)
      c.bezierCurveTo(180, 205, 290, 280, 440, 350)
      c.bezierCurveTo(620, 170, 740, 235, 890, 340)
      c.bezierCurveTo(1030, 255, 1150, 260, 1200, 305)
      c.lineTo(W, H)
      c.lineTo(0, H)
      c.fill()
      c.fillStyle = "#b9cfa7"
      c.beginPath()
      c.moveTo(0, 390)
      c.bezierCurveTo(240, 320, 420, 370, 570, 411)
      c.bezierCurveTo(840, 315, 1060, 354, 1200, 384)
      c.lineTo(W, H)
      c.lineTo(0, H)
      c.fill()
      c.fillStyle = "#9eb982"
      c.beginPath()
      c.moveTo(0, 435)
      c.bezierCurveTo(380, 403, 720, 432, 1200, 427)
      c.lineTo(W, H)
      c.lineTo(0, H)
      c.fill()
      c.fillStyle = "#e9d9b8"
      c.fillRect(0, ground + 8, W, H - ground)
      c.fillStyle = "#7f9e62"
      c.fillRect(0, ground, W, 9)
      c.fillStyle = "#d7c39f"
      for (let i = 0; i < 65; i++) {
        c.beginPath()
        c.ellipse(
          (i * 137) % W,
          466 + ((i * 31) % 76),
          2 + (i % 3),
          1.4,
          0,
          0,
          7,
        )
        c.fill()
      }
      c.strokeStyle = "#829e63"
      c.lineWidth = 2
      for (const x of [42, 76, 388, 630, 1128]) {
        c.beginPath()
        c.moveTo(x, 440)
        c.lineTo(x - 5, 427)
        c.moveTo(x, 440)
        c.lineTo(x + 6, 430)
        c.stroke()
      }
      for (let i = 0; i < g.shots - (g.flying ? 0 : 1); i++)
        birdArt(
          c,
          70 + i * 38,
          ground - 17,
          15,
          lineup[4 - g.shots + i + (g.flying ? 0 : 1)],
        )
      // The rear fork and elastic sit behind the loaded bird.
      c.strokeStyle = "#795036"
      c.lineWidth = 14
      c.lineCap = "round"
      c.beginPath()
      c.moveTo(229, 438)
      c.lineTo(235, 377)
      c.lineTo(214, 325)
      c.moveTo(235, 377)
      c.lineTo(258, 323)
      c.stroke()
      c.strokeStyle = "#ab784d"
      c.lineWidth = 5
      c.beginPath()
      c.moveTo(229, 432)
      c.lineTo(235, 376)
      c.lineTo(215, 326)
      c.stroke()
      const loaded = !g.flying && g.shots > 0 && !g.result
      if (loaded) {
        c.strokeStyle = "#664a38"
        c.lineWidth = 5
        c.beginPath()
        c.moveTo(214, 330)
        c.lineTo(g.bird.x, g.bird.y)
        c.lineTo(258, 328)
        c.stroke()
      }
      for (const p of g.trail) {
        c.fillStyle = "#fffdf4"
        c.strokeStyle = "#637e78"
        c.lineWidth = 1.5
        c.beginPath()
        c.arc(p.x, p.y, 4, 0, 7)
        c.fill()
        c.stroke()
      }
      if (g.dragging) {
        let x = g.bird.x,
          y = g.bird.y,
          vx = (anchor.x - x) * 0.155 * birds[g.type].speed,
          vy = (anchor.y - y) * 0.155 * birds[g.type].speed
        const points = [{ x, y }]
        for (let i = 0; i < 200; i++) {
          vy += 0.19
          x += vx
          y += vy
          points.push({ x, y })
          if (y >= ground - 20 || x > W || x < 0) break
        }
        c.save()
        c.setLineDash([9, 7])
        c.lineWidth = 5
        c.strokeStyle = "#fffdf5"
        c.beginPath()
        points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
        c.stroke()
        c.lineWidth = 2.5
        c.strokeStyle = "#397c85"
        c.stroke()
        c.setLineDash([])
        points.forEach((p, i) => {
          if (i % 8 === 0) {
            c.beginPath()
            c.arc(p.x, p.y, 4.5, 0, 7)
            c.fillStyle = "#397c85"
            c.fill()
            c.strokeStyle = "#fffdf5"
            c.lineWidth = 2
            c.stroke()
          }
        })
        const end = points[points.length - 1]
        c.strokeStyle = "#397c85"
        c.lineWidth = 2
        c.beginPath()
        c.arc(end.x, end.y, 10, 0, 7)
        c.moveTo(end.x - 15, end.y)
        c.lineTo(end.x + 15, end.y)
        c.moveTo(end.x, end.y - 15)
        c.lineTo(end.x, end.y + 15)
        c.stroke()
        c.restore()
      }
      for (const b of g.bodies)
        if (b.alive) {
          if (b.kind === "pig") pigArt(c, b.x, b.y, b.w / 2)
          else {
            c.fillStyle = b.kind === "stone" ? "#8b9da7" : "#bf8f58"
            c.strokeStyle = b.kind === "stone" ? "#586d7a" : "#9c7044"
            c.lineWidth = 2
            c.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)
            c.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)
            c.strokeStyle = b.kind === "stone" ? "#c4d0d5" : "#dda975"
            c.beginPath()
            c.moveTo(b.x - b.w / 2 + 5, b.y - b.h / 2 + 5)
            c.lineTo(b.x + b.w / 2 - 5, b.y + b.h / 2 - 5)
            c.moveTo(b.x + b.w / 2 - 5, b.y - b.h / 2 + 5)
            c.lineTo(b.x - b.w / 2 + 5, b.y + b.h / 2 - 5)
            c.stroke()
          }
        }
      if (loaded || g.flying) birdArt(c, g.bird.x, g.bird.y, 22, g.type)
      if (g.blast) {
        c.save()
        c.globalAlpha = g.blast / 30
        c.strokeStyle = "#f2a238"
        c.fillStyle = "#ffd27c55"
        c.lineWidth = 5
        c.beginPath()
        c.arc(g.blastX, g.blastY, 155 * (1 - g.blast / 35), 0, 7)
        c.fill()
        c.stroke()
        c.restore()
      }
      for (const p of g.particles) {
        c.globalAlpha = p.life / 38
        c.fillStyle = p.color
        c.fillRect(p.x, p.y, 5, 5)
      }
      c.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) * W) / r.width,
      y: ((e.clientY - r.top) * H) / r.height,
    }
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = game.current
    if (!g.dragging) return
    const p = point(e),
      dx = p.x - anchor.x,
      dy = p.y - anchor.y,
      scale = Math.min(1, 95 / Math.hypot(dx, dy))
    g.bird.x = anchor.x + dx * scale
    g.bird.y = anchor.y + dy * scale
  }
  function release(cancel = false) {
    const g = game.current
    if (!g.dragging) return
    g.dragging = false
    if (cancel || Math.hypot(g.bird.x - anchor.x, g.bird.y - anchor.y) < 8) {
      g.bird = { ...anchor, vx: 0, vy: 0 }
      return
    }
    g.bird.vx = (anchor.x - g.bird.x) * 0.155 * birds[g.type].speed
    g.bird.vy = (anchor.y - g.bird.y) * 0.155 * birds[g.type].speed
    g.flying = true
    g.shots--
    g.ticks = 0
    g.trail = []
    tone(700)
  }
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" width="30" height="30">
              <path d="M7 17C7 7 25 5 26 18c1 12-20 12-19-1" fill="#ed7252" />
              <path d="m10 8-2-5 7 3 4-3 1 5" fill="#ed7252" />
              <circle cx="21" cy="15" r="4" fill="#fff3d9" />
              <circle cx="22" cy="15" r="1.5" fill="#344738" />
              <path d="m25 18 7 3-7 3" fill="#e5ae42" />
              <path d="m4 17-4-3 1 9 6-3" fill="#c6523a" />
            </svg>
          </span>
          小鸟出击
          <span className="brand-divider" />{" "}
          <span className="brand-sub">BIRDIE BREAK</span>
        </a>
        <div className="header-right">
          <span className="play-dot" /> 把烦恼，弹出去。
          <button
            className="icon-button"
            aria-label="游戏帮助"
            onClick={() => setHelp(true)}
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">A LITTLE AIM. A LOT OF FUN.</div>
            <h1>
              瞄准快乐，<span>放手一搏。</span>
            </h1>
            <p>拉开弹弓，让小鸟飞一会儿。今天的好心情，由你发射。</p>
          </div>
          <div className="intro-stamp">
            <Icon name="target" size={25} />
            <div>
              小小挑战，大大快乐<span>轻松玩 · 随时重来</span>
            </div>
          </div>
        </div>
        <div className="level-picker" aria-label="选择关卡">
          <span>冒险地图</span>
          {levels.map((name, i) => (
            <button
              key={name}
              className={level === i + 1 ? "selected" : ""}
              aria-pressed={level === i + 1}
              onClick={() => reset(i + 1)}
              title={name}
            >
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{name}</span>
              <small>{i < 2 ? "入门" : i < 5 ? "进阶" : "困难"}</small>
            </button>
          ))}
        </div>
        <section className="game-card">
          <div className="toolbar">
            <div className="level-info">
              <span className="level-number">0{level}</span>
              <div>
                <strong>{levels[level - 1]}</strong>
                <span>
                  第 {level} 关 / 共 {levels.length} 关
                </span>
              </div>
            </div>
            <div className="stats">
              <div>
                <span>当前得分</span>
                <strong>{hud.score.toString().padStart(4, "0")}</strong>
              </div>
              <i />
              <div>
                <span>剩余小鸟</span>
                <strong className="bird-count">
                  <span className="mini-bird" /> {hud.shots}
                  <small>/ 4</small>
                </strong>
              </div>
            </div>
            <div className="tools">
              <button
                className="icon-button"
                aria-label={muted ? "开启声音" : "关闭声音"}
                onClick={() => setMuted(!muted)}
              >
                <Icon name={muted ? "mute" : "sound"} />
              </button>
              <button className="restart" onClick={() => reset()}>
                <Icon name="reset" size={17} />
                <span>重新开始</span>
              </button>
            </div>
          </div>
          <div className="playfield">
            <canvas
              ref={canvas}
              width={W}
              height={H}
              aria-label="弹弓小游戏：拖动左侧小鸟，向后拉并松开发射"
              onPointerDown={(e) => {
                const g = game.current,
                  p = point(e)
                if (g.flying) {
                  activate()
                  return
                }
                if (
                  !g.flying &&
                  g.shots > 0 &&
                  !g.result &&
                  Math.hypot(p.x - g.bird.x, p.y - g.bird.y) < 60
                ) {
                  g.dragging = true
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
              }}
              onPointerMove={move}
              onPointerUp={() => release()}
              onPointerCancel={() => release(true)}
            />
            <div className="field-label">
              <span /> 绿野草地 <span className="field-label-divider">/</span>{" "}
              SUNNY MEADOW
            </div>
            <div className="target-label">
              <Icon name="target" size={16} /> 剩余目标 <b>{hud.pigs}</b>
            </div>
            {!hud.score && hud.shots === 4 && (
              <div className="aim-hint">
                向后拖动小鸟，松开发射 <span>↙</span>
              </div>
            )}
            {hud.result && (
              <div className="result-scrim">
                <div className="result">
                  <span className="eyebrow">
                    {hud.result === "win" ? "BEAUTIFUL SHOT!" : "ONE MORE TRY?"}
                  </span>
                  <h2>
                    {hud.result === "win"
                      ? "漂亮，全部击倒！"
                      : "差一点，再来一次！"}
                  </h2>
                  <p>
                    {hud.result === "win"
                      ? `获得 ${hud.score} 分。好心情已成功送达。`
                      : "试试拉低一点，让小鸟飞得更远。"}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() =>
                      reset(
                        hud.result === "win"
                          ? (level % levels.length) + 1
                          : level,
                      )
                    }
                  >
                    {hud.result === "win"
                      ? level === levels.length
                        ? "从头再挑战"
                        : "挑战下一关"
                      : "再试一次"}
                    <Icon name="arrow" size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="game-bottom">
            <span>
              <span className="status-dot" />{" "}
              {hud.result ? "挑战结束" : "准备好，发射你的好心情"}
            </span>
            <span>
              无需下载 <i /> 即刻开玩
            </span>
          </div>
        </section>
        <section className="bird-roster">
          <div className="roster-title">
            <span className="eyebrow">MEET YOUR FLOCK</span>
            <h2>小鸟战队</h2>
            <p>固定出场顺序 · 每关 4 次机会</p>
          </div>
          {(Object.keys(birds) as BirdType[]).map((type) => (
            <div
              key={type}
              className={`bird-profile ${hud.type === type ? "active" : ""}`}
            >
              <span
                className="bird-avatar"
                style={{ background: birds[type].color }}
              >
                <i />
                <b />
              </span>
              <div>
                <h3>
                  {birds[type].name}
                  <small>{birds[type].skill}</small>
                </h3>
                <p>{birds[type].hint}</p>
              </div>
            </div>
          ))}
        </section>
        <div className="ability-strip">
          <span>
            <b>{birds[hud.type].name}</b> ·{" "}
            {hud.used ? "技能已释放" : birds[hud.type].hint}
          </span>
          <button
            disabled={
              !hud.flying || hud.used || hud.type === "red" || !!hud.result
            }
            onClick={activate}
          >
            {hud.type === "bomb"
              ? "立即引爆"
              : hud.type === "gold"
                ? "疾风加速"
                : "被动 · 强力撞击"}
            <kbd>SPACE</kbd>
          </button>
        </div>
        <section className="instructions">
          <div className="how-title">
            <span className="eyebrow">HOW TO PLAY</span>
            <h2>快乐，只需三步。</h2>
          </div>
          <div className="step">
            <span className="step-number">01</span>
            <div>
              <h3>向后拉</h3>
              <p>按住小鸟，向后拖动弹弓</p>
            </div>
          </div>
          <div className="step">
            <span className="step-number">02</span>
            <div>
              <h3>瞄准目标</h3>
              <p>调整角度，虚线帮你找准方向</p>
            </div>
          </div>
          <div className="step">
            <span className="step-number">03</span>
            <div>
              <h3>放手出击</h3>
              <p>松开手指，击倒所有绿色小猪</p>
            </div>
          </div>
        </section>
        <footer>
          <span>为一点点快乐而造。</span>
          <span>TAKE A BREAK. TAKE A SHOT.</span>
          <span>拖动 · 瞄准 · 发射</span>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">HOW TO PLAY</span>
            <h2 id="help-title">准备好出击了吗？</h2>
            <p>
              用鼠标或手指按住弹弓上的小鸟，向左下方拉动。参考轨迹虚线调整角度，松开即可发射。
            </p>
            <p>
              共有 8
              关，每关按赤羽、疾风、黑曜、赤羽的顺序出场。赤羽擅长强力撞击；疾风飞行时点击场景或按空格加速；黑曜撞击自动爆炸，也能手动引爆。石块需要多次攻击，爆炸可直接摧毁。击倒所有小猪即可通关。
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              知道了，开始玩
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
