'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { poseAt, signalAt, type Actor, type SceneKind } from './scenarios'

// 2.5D view of the same 400×300 scenes as the SVG stage. Stage pixels map to
// world units: (x, y) → (x - 200, 0, y - 150). An orthographic camera tilted
// so the 300-unit-deep stage exactly fills a 16:10 frame keeps cars that wait
// off-stage out of view.
export const STAGE_ASPECT = 1.6
const VIEW_W = 400
const VIEW_H = VIEW_W / STAGE_ASPECT
const PITCH = Math.asin(VIEW_H / 300)
const CAR_LENGTH = 28

const COLORS = {
    ground: '#cfdcc0',
    road: '#5a5f66',
    kerb: '#e6dfcb',
    paint: '#f7f7f2',
    yellow: '#f2c230',
    water: '#8fc3dc',
    deck: '#8c8478',
    rail: '#4a4540',
    island: '#a9c48a',
    leaf: ['#8fae69', '#7f9f5c', '#9cbb74'],
    trunk: '#8a6b4f',
}
const CAR_COLORS = ['#2f5d9e', '#4f8a5f', '#8a68b8', '#2b8a9e']
const HERO_COLOR = '#e8431a'
const VAN_COLOR = '#f1f1ee'

type Rect = [number, number, number, number]
type Line = [number, number, number, number]
type Geometry = {
    roads: Rect[]
    circles?: [number, number, number][]
    polys?: [number, number][][]
    water?: Rect
    deck?: Rect
    island?: [number, number, number]
    dashes: Line[]
    solid?: { line: Line; color: string; width: number; dashed?: boolean }[]
    signs?: [number, number][]
    labels?: { x: number; y: number; key: 'bridge' | 'bay' }[]
    trees: [number, number][]
}

// Roads run well past the stage edges so the tilted view never shows their ends.
const GEOMETRY: Record<SceneKind, Geometry> = {
    keepLeft: {
        roads: [[-300, 115, 1000, 70], [178, 185, 44, 400]],
        dashes: [[-300, 150, 172, 150], [228, 150, 700, 150], [200, 196, 200, 600]],
        solid: [{ line: [178, 190, 200, 190], color: COLORS.paint, width: 3 }],
        trees: [[40, 60], [95, 40], [300, 55], [360, 80], [60, 240], [120, 270], [290, 230], [355, 265]],
    },
    roundabout: {
        roads: [[-300, 128, 1000, 44], [178, -300, 44, 900]],
        circles: [[200, 150, 74]],
        island: [200, 150, 34],
        dashes: [[-300, 150, 118, 150], [282, 150, 700, 150], [200, -300, 200, 68], [200, 232, 200, 600]],
        solid: [{ line: [178, 228, 200, 228], color: COLORS.paint, width: 3, dashed: true }],
        signs: [[160, 250]],
        trees: [[45, 45], [110, 70], [320, 40], [365, 95], [50, 255], [300, 240], [360, 270], [115, 230]],
    },
    bridge: {
        water: [160, -300, 80, 900],
        roads: [[-300, 115, 435, 70], [265, 115, 435, 70]],
        polys: [[[135, 115], [150, 134], [150, 166], [135, 185]], [[265, 115], [250, 134], [250, 166], [265, 185]]],
        deck: [150, 134, 100, 32],
        dashes: [[-300, 150, 130, 150], [270, 150, 700, 150]],
        signs: [[78, 62]],
        labels: [{ x: 200, y: 118, key: 'bridge' }],
        trees: [[30, 40], [120, 30], [285, 45], [350, 70], [40, 240], [110, 265], [300, 250], [365, 225]],
    },
    turnGiveWay: {
        roads: [[-300, 128, 1000, 44], [178, -300, 44, 900]],
        dashes: [[-300, 150, 172, 150], [228, 150, 700, 150], [200, -300, 200, 122], [200, 178, 200, 600]],
        solid: [
            { line: [178, 176, 200, 176], color: COLORS.paint, width: 3 },
            { line: [200, 124, 222, 124], color: COLORS.paint, width: 3 },
        ],
        trees: [[50, 50], [120, 85], [300, 60], [360, 95], [60, 240], [125, 210], [290, 250], [355, 215]],
    },
    overtake: {
        roads: [[-300, 115, 1000, 70]],
        polys: [[[200, 115], [225, 93], [320, 93], [345, 115]]],
        dashes: [],
        solid: [
            { line: [-300, 147, 700, 147], color: COLORS.yellow, width: 2.5 },
            { line: [-300, 153, 700, 153], color: COLORS.yellow, width: 2.5 },
        ],
        labels: [{ x: 272, y: 80, key: 'bay' }],
        trees: [[40, 50], [110, 70], [170, 40], [370, 60], [50, 240], [140, 260], [250, 230], [340, 255]],
    },
}

const world = (x: number, y: number) => new THREE.Vector3(x - 200, 0, y - 150)

function flatMaterial(color: string) {
    return new THREE.MeshLambertMaterial({ color })
}

// A flat rectangle lying on the ground at height h.
function slab(rect: Rect, color: string, h: number, thickness = 0.4) {
    const [x, y, w, d] = rect
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), flatMaterial(color))
    mesh.position.copy(world(x + w / 2, y + d / 2)).setY(h - thickness / 2)
    mesh.receiveShadow = true
    return mesh
}

function disc(cx: number, cy: number, r: number, color: string, h: number, thickness = 0.4) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, 64), flatMaterial(color))
    mesh.position.copy(world(cx, cy)).setY(h - thickness / 2)
    mesh.receiveShadow = true
    return mesh
}

function poly(points: [number, number][], color: string, h: number) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x - 200, -(y - 150))))
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), flatMaterial(color))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = h
    mesh.receiveShadow = true
    return mesh
}

// Painted line, optionally dashed, as thin strips on the road surface.
function paint(group: THREE.Group, [x1, y1, x2, y2]: Line, color: string, width: number, dash?: [number, number]) {
    const length = Math.hypot(x2 - x1, y2 - y1)
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const material = flatMaterial(color)
    const segments: [number, number][] = dash
        ? Array.from({ length: Math.ceil(length / (dash[0] + dash[1])) }, (_, i) => [i * (dash[0] + dash[1]), Math.min(length, i * (dash[0] + dash[1]) + dash[0])])
        : [[0, length]]
    for (const [from, to] of segments) {
        const piece = new THREE.Mesh(new THREE.PlaneGeometry(to - from, width), material)
        const mid = (from + to) / 2
        piece.rotation.x = -Math.PI / 2
        piece.rotation.z = -angle
        piece.position.copy(world(x1 + Math.cos(angle) * mid, y1 + Math.sin(angle) * mid)).setY(0.62)
        piece.receiveShadow = true
        group.add(piece)
    }
}

function tree(x: number, y: number, seed: number) {
    const group = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 5, 6), flatMaterial(COLORS.trunk))
    trunk.position.y = 2.5
    trunk.castShadow = true
    group.add(trunk)
    const blobs: [number, number, number, number][] = [[0, 9, 0, 6], [-4, 7.5, 1.5, 4.5], [4, 7.5, -1, 4.8]]
    blobs.forEach(([bx, by, bz, r], i) => {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), flatMaterial(COLORS.leaf[(seed + i) % COLORS.leaf.length]))
        leaf.position.set(bx, by, bz)
        leaf.rotation.set(seed, seed * 2, 0)
        leaf.castShadow = true
        group.add(leaf)
    })
    group.position.copy(world(x, y))
    group.scale.setScalar(0.9 + (seed % 3) * 0.12)
    return group
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

function sprite(texture: THREE.Texture, width: number, height: number) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
    s.scale.set(width, height, 1)
    s.renderOrder = 10
    return s
}

function giveWaySign(x: number, y: number, label: string) {
    const group = new THREE.Group()
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), flatMaterial('#7b8794'))
    post.position.y = 7
    post.castShadow = true
    group.add(post)
    const texture = canvasTexture(256, 232, ctx => {
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(16, 16); ctx.lineTo(240, 16); ctx.lineTo(128, 216); ctx.closePath()
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.lineWidth = 22; ctx.strokeStyle = '#d7262d'; ctx.stroke()
        ctx.fillStyle = '#1f2937'
        ctx.font = `800 ${label.length > 3 ? 34 : 44}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, 128, 80)
    })
    const face = sprite(texture, 20, 18)
    face.position.y = 20
    face.material.depthTest = true
    group.add(face)
    group.position.copy(world(x, y))
    return group
}

function textLabel(text: string) {
    const texture = canvasTexture(512, 96, ctx => {
        ctx.font = '800 44px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 10
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.strokeText(text, 256, 48)
        ctx.fillStyle = '#1a2b6b'
        ctx.fillText(text, 256, 48)
    })
    return sprite(texture, 64, 12)
}

function badge(text: string, color: string) {
    const texture = canvasTexture(192, 150, ctx => {
        ctx.fillStyle = color
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.roundRect(14, 10, 164, 100, 22)
        ctx.moveTo(78, 108); ctx.lineTo(96, 136); ctx.lineTo(114, 108)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = `800 ${text.length > 2 ? 58 : 64}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 96, 62)
    })
    const tag = sprite(texture, 17, 13.3)
    tag.renderOrder = 11
    return tag
}

const BLINK_MS = 600

// Amber indicator lamps on the four corners of a car, with a soft glow. The
// group follows the car (unscaled) so the lamps sit at its corners.
function indicators(van: boolean) {
    const group = new THREE.Group()
    const halfLength = (van ? 40 : CAR_LENGTH) / 2 - 1.5
    const halfWidth = van ? 7 : 5.6
    const glowTexture = canvasTexture(64, 64, ctx => {
        const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
        glow.addColorStop(0, 'rgba(255,214,90,1)')
        glow.addColorStop(0.35, 'rgba(255,170,30,0.75)')
        glow.addColorStop(1, 'rgba(255,150,0,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, 64, 64)
    })
    const lamps: Record<'left' | 'right', THREE.Object3D[]> = { left: [], right: [] }
    for (const side of ['left', 'right'] as const) {
        // Facing +x, the car's left is -z (up the screen).
        const z = side === 'left' ? -halfWidth : halfWidth
        for (const x of [halfLength, -halfLength]) {
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2), new THREE.MeshBasicMaterial({ color: '#ffb31a' }))
            lamp.position.set(x, 4.5, z)
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, depthWrite: false, transparent: true }))
            glow.scale.set(9, 9, 1)
            glow.position.set(x, 6, z)
            glow.renderOrder = 8
            group.add(lamp, glow)
            lamps[side].push(lamp, glow)
        }
    }
    group.visible = false
    return { group, lamps }
}

function crashBurst() {
    const texture = canvasTexture(256, 256, ctx => {
        const glow = ctx.createRadialGradient(128, 128, 10, 128, 128, 124)
        glow.addColorStop(0, 'rgba(220,38,38,0.55)')
        glow.addColorStop(1, 'rgba(220,38,38,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, 256, 256)
        ctx.beginPath()
        for (let i = 0; i < 20; i++) {
            const r = i % 2 ? 34 : 78
            const a = (i / 20) * Math.PI * 2 - Math.PI / 2
            ctx[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * r, 128 + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fillStyle = '#facc15'
        ctx.fill()
        ctx.lineWidth = 10
        ctx.strokeStyle = '#dc2626'
        ctx.stroke()
    })
    const burst = sprite(texture, 32, 32)
    burst.renderOrder = 9
    return burst
}

function buildEnvironment(kind: SceneKind, labels: Record<string, string>) {
    const g = GEOMETRY[kind]
    const group = new THREE.Group()
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), flatMaterial(COLORS.ground))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    group.add(ground)
    if (g.water) group.add(slab(g.water, COLORS.water, 0.05, 0.1))
    // Kerbs are slightly larger road shapes underneath; the road covers them
    // everywhere except along the outer edges.
    for (const [x, y, w, d] of g.roads) group.add(slab([x - 4, y - 4, w + 8, d + 8], COLORS.kerb, 0.35))
    for (const [cx, cy, r] of g.circles || []) group.add(disc(cx, cy, r + 4, COLORS.kerb, 0.35))
    for (const rect of g.roads) group.add(slab(rect, COLORS.road, 0.5))
    for (const [cx, cy, r] of g.circles || []) group.add(disc(cx, cy, r, COLORS.road, 0.5))
    for (const points of g.polys || []) group.add(poly(points, COLORS.road, 0.5))
    if (g.island) {
        const [cx, cy, r] = g.island
        group.add(disc(cx, cy, r + 3, COLORS.paint, 1.6, 1.2))
        group.add(disc(cx, cy, r, COLORS.island, 1.9, 1.5))
    }
    if (g.deck) {
        const [x, y, w, d] = g.deck
        group.add(slab(g.deck, COLORS.deck, 1.2, 1.2))
        for (const ry of [y, y + d]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 3, 1.6), flatMaterial(COLORS.rail))
            rail.position.copy(world(x + w / 2, ry)).setY(2.5)
            rail.castShadow = true
            group.add(rail)
        }
    }
    for (const line of g.dashes) paint(group, line, COLORS.paint, 2, [10, 9])
    for (const s of g.solid || []) paint(group, s.line, s.color, s.width, s.dashed ? [5, 3] : undefined)
    for (const [x, y] of g.signs || []) group.add(giveWaySign(x, y, labels.giveWay))
    for (const l of g.labels || []) {
        const label = textLabel(labels[l.key])
        label.position.copy(world(l.x, l.y)).setY(6)
        group.add(label)
    }
    g.trees.forEach(([x, y], i) => group.add(tree(x, y, i * 7 + x)))
    return group
}

// The model's colour palette texture uses three swatches for the paintwork.
// Repainting them gives every car its own colour without touching glass or tyres.
const BODY_SWATCHES: { cell: [number, number]; mix: number }[] = [
    { cell: [1, 11], mix: 0 },
    { cell: [0, 11], mix: 0.18 },
    { cell: [3, 11], mix: 0.38 },
]

function repaint(source: THREE.Texture, color: string) {
    const image = source.image as CanvasImageSource & { width: number; height: number }
    const texture = canvasTexture(image.width, image.height, ctx => {
        ctx.drawImage(image, 0, 0)
        const cell = image.width / 16
        const base = new THREE.Color(color)
        for (const { cell: [cx, cy], mix } of BODY_SWATCHES) {
            ctx.fillStyle = `#${base.clone().lerp(new THREE.Color('#ffffff'), mix).getHexString()}`
            ctx.fillRect(cx * cell, cy * cell, cell, cell)
        }
    })
    texture.flipY = false
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    return texture
}

type CarTemplate = { scene: THREE.Object3D; length: number }

let templatePromise: Promise<CarTemplate> | null = null
function loadCarTemplate() {
    templatePromise ??= new GLTFLoader().loadAsync('/models/low-poly-car.glb').then(gltf => {
        const root = gltf.scene
        root.traverse(node => {
            if (node.name.startsWith('Collider')) node.visible = false
        })
        root.getObjectByName('Collider')?.removeFromParent()
        const box = new THREE.Box3().setFromObject(root)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const wrapper = new THREE.Group()
        root.position.set(-center.x, -box.min.y, -center.z)
        wrapper.add(root)
        return { scene: wrapper, length: size.x }
    })
    return templatePromise
}

function makeCar(template: CarTemplate, color: string, van: boolean) {
    const car = template.scene.clone(true)
    car.traverse(node => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        const material = (mesh.material as THREE.MeshStandardMaterial).clone()
        material.metalness = 0
        material.roughness = 0.75
        if (material.name === 'TransportPack') {
            material.transparent = false
            material.depthWrite = true
            if (material.map) material.map = repaint(material.map, color)
        }
        mesh.material = material
    })
    const scale = CAR_LENGTH / template.length
    car.scale.set(scale * (van ? 1.45 : 1), scale * (van ? 1.25 : 1), scale * (van ? 1.15 : 1))
    return car
}

function boxCar(color: string, van: boolean) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(van ? 40 : 28, 9, van ? 17 : 14), flatMaterial(color))
    mesh.position.y = 4.5
    mesh.castShadow = true
    const group = new THREE.Group()
    group.add(mesh)
    return group
}

type Props = {
    scene: SceneKind
    actors: Actor[]
    t: number
    crash?: { x: number; y: number } | null
    labels: { you: string; giveWay: string; bridge: string; bay: string }
    onUnsupported: () => void
}

type StageState = {
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.OrthographicCamera
    environment?: THREE.Group
    cars: { actor: Actor; object: THREE.Object3D; badge?: THREE.Sprite; lights: ReturnType<typeof indicators> }[]
    carLayer: THREE.Group
    burst: THREE.Sprite
    template?: CarTemplate
}

export default function Stage3D({ scene, actors, t, crash, labels, onUnsupported }: Props) {
    const host = useRef<HTMLDivElement>(null)
    const stage = useRef<StageState | null>(null)
    const latest = useRef({ t, crash, actors })
    latest.current = { t, crash, actors }
    const signalling = useRef(false)

    const render = () => {
        const s = stage.current
        if (!s) return
        const { t: time, crash: hit } = latest.current
        const blinkOn = performance.now() % BLINK_MS < BLINK_MS * 0.55
        signalling.current = false
        for (const car of s.cars) {
            const pose = poseAt(car.actor.keys, time)
            car.object.visible = Boolean(pose)
            if (car.badge) car.badge.visible = Boolean(pose)
            const side = pose && !hit ? signalAt(car.actor, time) : null
            car.lights.group.visible = Boolean(side && blinkOn)
            if (side) signalling.current = true
            if (!pose) continue
            car.object.position.copy(world(pose.x, pose.y))
            car.object.rotation.y = (-pose.r * Math.PI) / 180
            car.lights.group.position.copy(car.object.position)
            car.lights.group.rotation.y = car.object.rotation.y
            for (const lamp of car.lights.lamps.left) lamp.visible = side === 'left'
            for (const lamp of car.lights.lamps.right) lamp.visible = side === 'right'
            car.badge?.position.copy(world(pose.x, pose.y)).setY(36)
        }
        s.burst.visible = Boolean(hit)
        if (hit) s.burst.position.copy(world(hit.x, hit.y)).setY(16)
        s.renderer.render(s.scene, s.camera)
    }

    // One-off WebGL setup.
    useEffect(() => {
        const container = host.current
        if (!container) return
        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true })
        } catch {
            onUnsupported()
            return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.setClearColor(COLORS.ground)
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'

        const threeScene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-VIEW_W / 2, VIEW_W / 2, VIEW_H / 2, -VIEW_H / 2, 1, 2000)
        camera.position.set(0, Math.sin(PITCH) * 800, Math.cos(PITCH) * 800)
        camera.lookAt(0, 0, 0)

        threeScene.add(new THREE.HemisphereLight('#ffffff', '#9fae8f', 1.35))
        const sun = new THREE.DirectionalLight('#fff6e8', 1.7)
        sun.position.set(-140, 300, 120)
        sun.castShadow = true
        sun.shadow.mapSize.set(2048, 2048)
        Object.assign(sun.shadow.camera, { left: -280, right: 280, top: 220, bottom: -220, near: 10, far: 900 })
        sun.shadow.camera.updateProjectionMatrix()
        sun.shadow.radius = 4
        sun.shadow.bias = -0.0005
        threeScene.add(sun)

        const carLayer = new THREE.Group()
        threeScene.add(carLayer)
        const burst = crashBurst()
        burst.visible = false
        threeScene.add(burst)

        stage.current = { renderer, scene: threeScene, camera, cars: [], carLayer, burst }

        const resize = () => {
            const width = container.clientWidth
            renderer.setSize(width, width / STAGE_ASPECT, false)
            render()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()

        return () => {
            observer.disconnect()
            threeScene.traverse(node => {
                const mesh = node as THREE.Mesh
                mesh.geometry?.dispose()
                const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
                materials.forEach(material => {
                    (material as THREE.MeshStandardMaterial).map?.dispose()
                    material.dispose()
                })
            })
            renderer.dispose()
            renderer.domElement.remove()
            stage.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Rebuild the road layout when the scene changes.
    useEffect(() => {
        const s = stage.current
        if (!s) return
        if (s.environment) s.scene.remove(s.environment)
        s.environment = buildEnvironment(scene, labels)
        s.scene.add(s.environment)
        render()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, labels.giveWay])

    // Recreate the cars for each scenario variant, swapping in the real model
    // once it has loaded.
    useEffect(() => {
        let cancelled = false
        const build = () => {
            const s = stage.current
            if (!s || cancelled) return
            s.carLayer.clear()
            let carIndex = 0
            s.cars = actors.map(actor => {
                const van = actor.kind === 'van'
                const color = actor.kind === 'hero' ? HERO_COLOR : van ? VAN_COLOR : CAR_COLORS[carIndex++ % CAR_COLORS.length]
                const object = s.template ? makeCar(s.template, color, van) : boxCar(color, van)
                s.carLayer.add(object)
                const tag = actor.kind === 'hero' ? badge(labels.you, HERO_COLOR) : undefined
                if (tag) s.carLayer.add(tag)
                const lights = indicators(van)
                s.carLayer.add(lights.group)
                return { actor, object, badge: tag, lights }
            })
            render()
        }
        build()
        loadCarTemplate().then(template => {
            if (!stage.current || cancelled) return
            const needsRebuild = !stage.current.template
            stage.current.template = template
            if (needsRebuild) build()
        }).catch(() => { /* keep the box cars */ })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actors, labels.you])

    useEffect(render, [t, crash])

    // Keep indicators blinking while the animation is paused on a turn.
    useEffect(() => {
        const timer = window.setInterval(() => { if (signalling.current) render() }, BLINK_MS / 4)
        return () => window.clearInterval(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return <div ref={host} className="w-full" style={{ aspectRatio: String(STAGE_ASPECT) }} />
}
