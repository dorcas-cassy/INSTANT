import './style.css'
import * as THREE from 'three'

document.querySelector('#app').innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">+</span><span>NEON//RANGE</span></div>
      <div class="round-status"><span class="status-dot"></span> LIVE COMBAT SIMULATION</div>
      <div class="build-tag">ARENA 01 <span>•</span> SOLO</div>
    </header>
    <section class="game-frame" aria-label="Neon Range first-person shooter">
      <div id="scene"></div>
      <div class="vignette"></div>
      <div class="crosshair"><i></i><b></b><em></em><strong></strong></div>
      <div class="hud hud-left">
        <div class="hud-label">OPERATOR</div>
        <div class="health-track"><span id="health-bar"></span></div>
        <div class="health-readout"><b id="health-value">100</b><small>HP</small></div>
      </div>
      <div class="hud hud-right">
        <div class="hud-label">TARGET</div>
        <div class="target-readout"><span id="target-state">ACTIVE</span><b id="enemy-distance">-- M</b></div>
        <div class="target-track"><span id="target-bar"></span></div>
      </div>
      <div class="combat-hud">
        <div><small>ROUND TIME</small><b id="round-time">00:00</b></div>
        <div><small>SHOTS FIRED</small><b id="shot-count">000</b></div>
        <div class="danger-readout"><small>THREAT</small><b id="danger-state">TRACKING</b></div>
      </div>
      <div class="weapon-readout"><span class="ammo-count" id="ammo-value">∞</span><span class="ammo-label">PULSE<br>CHAMBER</span></div>
      <div class="objective"><span class="objective-number">01</span><div><small>OBJECTIVE</small><p>Neutralize the arena sentinel</p></div></div>
      <div class="controls-hint"><span>ARROW KEYS</span> MOVE <span>SPACE</span> FIRE</div>
      <div id="round-over" class="round-over" hidden>
        <div class="result-kicker">SIMULATION COMPLETE</div>
        <h1 id="result-title">TARGET DOWN</h1>
        <p id="result-copy">Arena cleared in <span id="final-time">00:00</span></p>
        <button id="restart" type="button">REDEPLOY <span>↗</span></button>
      </div>
    </section>
    <footer class="footer"><span>THREAT LEVEL <b>HIGH</b></span><span>PROTOCOL: KEEP MOVING</span><span>BUILD 2.7.04</span></footer>
  </main>
`

const sceneHost = document.querySelector('#scene')
const scene = new THREE.Scene()
scene.background = new THREE.Color('#101b21')
scene.fog = new THREE.Fog('#101b21', 24, 58)

const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 100)
camera.position.set(0, 2.1, 12)
camera.rotation.order = 'YXZ'
camera.rotation.y = 0

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
sceneHost.appendChild(renderer.domElement)

let lastFrame = performance.now()
const keys = {}
const player = { health: 100, position: new THREE.Vector3(0, 2.1, 12) }
const bot = { health: 100, position: new THREE.Vector3(0, 1.35, -7), velocity: new THREE.Vector3(), fireTimer: 0.8, alive: true }
const projectiles = []
const sparks = []
let elapsed = 0
let gameOver = false
let shotCooldown = 0
let shotsFired = 0

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#1b3034', roughness: 0.82, metalness: 0.15 }),
  wall: new THREE.MeshStandardMaterial({ color: '#263c40', roughness: 0.7, metalness: 0.25 }),
  accent: new THREE.MeshBasicMaterial({ color: '#d4ff47' }),
  player: new THREE.MeshStandardMaterial({ color: '#7de0d6', roughness: 0.4, metalness: 0.5 }),
  enemy: new THREE.MeshStandardMaterial({ color: '#ff675c', roughness: 0.35, metalness: 0.4 }),
}

scene.add(new THREE.HemisphereLight('#d6fff2', '#102027', 2.2))
const sun = new THREE.DirectionalLight('#fff1d1', 3.5)
sun.position.set(-8, 18, 10)
sun.castShadow = true
scene.add(sun)

const floor = new THREE.Mesh(new THREE.PlaneGeometry(38, 34), materials.floor)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

function addBox(x, y, z, width, height, depth, material = materials.wall, accent = false) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  box.position.set(x, y, z)
  box.castShadow = true
  box.receiveShadow = true
  scene.add(box)
  if (accent) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, 0.04, 0.05), materials.accent)
    strip.position.set(x, y + height / 2 + 0.025, z - depth / 2 - 0.03)
    scene.add(strip)
  }
}

addBox(0, 1.5, -16, 38, 3, 0.6, materials.wall, true)
addBox(0, 1.5, 16, 38, 3, 0.6)
addBox(-19, 1.5, 0, 0.6, 3, 32)
addBox(19, 1.5, 0, 0.6, 3, 32)
addBox(-9, 1.2, -2, 5, 2.4, 2, materials.wall, true)
addBox(10, 1.4, 4, 4, 2.8, 2.2, materials.wall, true)
addBox(-10, 0.8, 9, 3, 1.6, 2.5)
addBox(8, 0.8, -8, 3, 1.6, 2.5)

for (let x = -15; x <= 15; x += 3) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 32), materials.accent)
  line.position.set(x, 0.012, 0)
  line.material.transparent = true
  line.material.opacity = 0.16
  scene.add(line)
}

const botGroup = new THREE.Group()
const botBody = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.5, 0.75), materials.enemy)
botBody.position.y = 0.9
botBody.castShadow = true
botGroup.add(botBody)
const botHead = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.78), materials.enemy)
botHead.position.y = 2.0
botHead.castShadow = true
botGroup.add(botHead)
const botEye = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.04), materials.accent)
botEye.position.set(0, 2.08, 0.4)
botGroup.add(botEye)
botGroup.position.copy(bot.position)
scene.add(botGroup)

const weapon = new THREE.Group()
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.28), new THREE.MeshStandardMaterial({ color: '#203338', metalness: 0.75, roughness: 0.26 }))
grip.rotation.x = -0.18
grip.position.set(0, -0.26, 0)
weapon.add(grip)
const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 1.35), new THREE.MeshStandardMaterial({ color: '#a7c6bd', metalness: 0.8, roughness: 0.2 }))
barrel.position.set(0, 0.08, -0.48)
weapon.add(barrel)
const barrelLight = new THREE.PointLight('#d4ff47', 0, 4)
barrelLight.position.set(0, 0.08, -1.15)
weapon.add(barrelLight)
weapon.position.set(0.62, -0.58, -1.15)
weapon.rotation.y = -0.11
camera.add(weapon)
scene.add(camera)

function createProjectile(origin, direction, hostile = false) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: hostile ? '#ff675c' : '#d4ff47' }))
  mesh.position.copy(origin)
  scene.add(mesh)
  projectiles.push({ mesh, direction: direction.clone().normalize(), hostile, life: 2.2 })
}

function fire() {
  if (gameOver || shotCooldown > 0 || !bot.alive) return
  shotCooldown = 0.22
  shotsFired += 1
  barrelLight.intensity = 3
  const origin = new THREE.Vector3()
  barrel.getWorldPosition(origin)
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  createProjectile(origin, direction)
  bot.health = Math.max(0, bot.health - 10)
  updateHud()
  if (bot.health === 0) endRound(true)
}

function botFire() {
  if (!bot.alive) return
  const origin = botGroup.position.clone().add(new THREE.Vector3(0, 1.45, 0))
  createProjectile(origin, player.position.clone().sub(origin))
}

function updateHud() {
  document.querySelector('#health-value').textContent = Math.ceil(player.health)
  document.querySelector('#health-bar').style.width = `${player.health}%`
  document.querySelector('#target-bar').style.width = `${bot.health}%`
  document.querySelector('#enemy-distance').textContent = `${Math.round(botGroup.position.distanceTo(camera.position))} M`
  document.querySelector('#target-state').textContent = bot.alive ? 'ACTIVE' : 'NEUTRALIZED'
  document.querySelector('#round-time').textContent = formatTime(elapsed)
  document.querySelector('#shot-count').textContent = String(shotsFired).padStart(3, '0')
  const danger = player.health <= 35 || botGroup.position.distanceTo(camera.position) < 9
  document.querySelector('#danger-state').textContent = danger ? 'IMMINENT' : 'TRACKING'
  document.querySelector('.danger-readout').classList.toggle('is-danger', danger)
}

function createSpark(position, color) {
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), new THREE.MeshBasicMaterial({ color }))
  spark.position.copy(position)
  scene.add(spark)
  sparks.push({ mesh: spark, life: 0.3 })
}

function endRound(won) {
  if (gameOver) return
  gameOver = true
  bot.alive = false
  document.querySelector('#result-title').textContent = won ? 'TARGET DOWN' : 'OPERATOR LOST'
  document.querySelector('#result-copy').innerHTML = won ? `Arena cleared in <span id="final-time">${formatTime(elapsed)}</span>` : 'The sentinel reached a firing solution.'
  document.querySelector('#round-over').hidden = false
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function resetGame() {
  player.health = 100
  player.position.set(0, 2.1, 12)
  camera.position.copy(player.position)
  bot.health = 100
  bot.position.set(0, 1.35, -7)
  botGroup.position.copy(bot.position)
  bot.alive = true
  elapsed = 0
  gameOver = false
  shotsFired = 0
  projectiles.forEach(({ mesh }) => scene.remove(mesh))
  projectiles.length = 0
  document.querySelector('#round-over').hidden = true
  updateHud()
}

function update(delta) {
  if (gameOver) return
  elapsed += delta
  shotCooldown = Math.max(0, shotCooldown - delta)
  barrelLight.intensity = Math.max(0, barrelLight.intensity - delta * 18)
  const move = new THREE.Vector3()
  if (keys.ArrowUp) move.z -= 1
  if (keys.ArrowDown) move.z += 1
  if (keys.ArrowLeft) move.x -= 1
  if (keys.ArrowRight) move.x += 1
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(delta * 7)
    player.position.add(move)
    player.position.x = THREE.MathUtils.clamp(player.position.x, -16.8, 16.8)
    player.position.z = THREE.MathUtils.clamp(player.position.z, 10.5, 15)
    camera.position.copy(player.position)
    weapon.position.y = -0.58 + Math.sin(elapsed * 12) * 0.012
  }
  bot.fireTimer -= delta
  botGroup.lookAt(camera.position.x, botGroup.position.y + 1.2, camera.position.z)
  const desired = new THREE.Vector3(player.position.x, botGroup.position.y, player.position.z)
  const distance = botGroup.position.distanceTo(desired)
  if (distance > 6) botGroup.position.add(desired.sub(botGroup.position).normalize().multiplyScalar(delta * 1.8))
  if (bot.fireTimer <= 0) {
    botFire()
    bot.fireTimer = 0.85
  }
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i]
    projectile.mesh.position.add(projectile.direction.clone().multiplyScalar(delta * 22))
    projectile.life -= delta
    const hit = projectile.hostile ? projectile.mesh.position.distanceTo(camera.position) < 0.75 : projectile.mesh.position.distanceTo(botGroup.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.15
    if (hit) {
      if (projectile.hostile) {
        player.health = Math.max(0, player.health - 18)
        createSpark(projectile.mesh.position, '#ff675c')
        if (player.health === 0) endRound(false)
      }
      scene.remove(projectile.mesh)
      projectiles.splice(i, 1)
    } else if (projectile.life <= 0) {
      scene.remove(projectile.mesh)
      projectiles.splice(i, 1)
    }
  }
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    sparks[i].life -= delta
    sparks[i].mesh.scale.multiplyScalar(0.9)
    if (sparks[i].life <= 0) {
      scene.remove(sparks[i].mesh)
      sparks.splice(i, 1)
    }
  }
  updateHud()
}

function resize() {
  const width = sceneHost.clientWidth
  const height = sceneHost.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

window.addEventListener('resize', resize)
window.addEventListener('keydown', (event) => {
  keys[event.key] = true
  if (event.code === 'Space') {
    event.preventDefault()
    fire()
  }
})
window.addEventListener('keyup', (event) => { keys[event.key] = false })
document.querySelector('#restart').addEventListener('click', resetGame)

resize()
updateHud()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now
  update(delta)
  renderer.render(scene, camera)
})
