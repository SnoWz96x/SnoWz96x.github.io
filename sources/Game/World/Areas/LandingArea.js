import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import helvetikerBoldFont from 'three/examples/fonts/helvetiker_bold.typeface.json'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        LandingArea.setNameLetters(model)

        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    static setNameLetters(model)
    {
        const text = 'ALLAN ALTARUGIO'
        const letters = text.replace(/\s/g, '').split('')
        const wordBreakIndex = text.indexOf(' ')
        const font = new FontLoader().parse(helvetikerBoldFont)

        const references = model.children
            .filter(child => child.name.startsWith('refLettersPhysicalDynamic'))
            .sort((a, b) => a.position.x - b.position.x)

        if(references.length === 0)
            return

        const firstReference = references[0]
        const lastReference = references[references.length - 1]
        const previousReference = references[references.length - 2]
        const material = firstReference.material
        const cuboidTemplate = firstReference.children.find(child => child.name.startsWith('cuboid'))
        const lastStep = lastReference.position.clone().sub(previousReference.position)
        const originalPositions = references.map(reference => reference.position.clone())

        firstReference.geometry.computeBoundingBox()
        const targetHeight = firstReference.geometry.boundingBox.max.y - firstReference.geometry.boundingBox.min.y
        const depth = firstReference.geometry.boundingBox.max.z - firstReference.geometry.boundingBox.min.z

        const getPosition = (logicalIndex) =>
        {
            if(logicalIndex < originalPositions.length)
                return originalPositions[logicalIndex].clone()

            return originalPositions[originalPositions.length - 1].clone().add(
                lastStep.clone().multiplyScalar(logicalIndex - originalPositions.length + 1)
            )
        }

        const createGeometry = (letter) =>
        {
            const geometry = new TextGeometry(letter, {
                font,
                size: 1,
                depth,
                curveSegments: 8,
                bevelEnabled: false
            })

            geometry.computeBoundingBox()

            const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y
            const scale = targetHeight / height

            geometry.scale(scale, scale, 1)
            geometry.computeBoundingBox()
            geometry.center()
            geometry.computeBoundingBox()
            geometry.computeVertexNormals()

            const uvs = geometry.attributes.uv.array
            for(let i = 0; i < uvs.length; i += 2)
            {
                uvs[i + 0] = 0.7356
                uvs[i + 1] = 0.5
            }
            geometry.attributes.uv.needsUpdate = true

            return geometry
        }

        for(let i = 0; i < letters.length; i++)
        {
            let reference = references[i]
            const suffix = (10 + i).toString().padStart(3, '0')

            if(!reference)
            {
                reference = new THREE.Mesh(undefined, material)
                reference.name = `refLettersPhysicalDynamic.${suffix}`
                reference.userData = { ...firstReference.userData }
                reference.quaternion.copy(firstReference.quaternion)
                reference.scale.copy(firstReference.scale)

                if(cuboidTemplate)
                {
                    const cuboid = cuboidTemplate.clone(false)
                    cuboid.name = `cuboid.${suffix}`
                    reference.add(cuboid)
                }

                model.add(reference)
            }

            reference.name = `refLettersPhysicalDynamic.${suffix}`
            reference.geometry = createGeometry(letters[i])

            const logicalIndex = i < wordBreakIndex ? i : i + 1
            reference.position.copy(getPosition(logicalIndex))

            const cuboid = reference.children.find(child => child.name.startsWith('cuboid'))
            if(cuboid)
            {
                reference.geometry.computeBoundingBox()

                cuboid.scale.x = Math.max(
                    reference.geometry.boundingBox.max.x - reference.geometry.boundingBox.min.x,
                    0.35
                )
                cuboid.scale.y = targetHeight
                cuboid.scale.z = depth
            }
        }

        for(let i = letters.length; i < references.length; i++)
            references[i].removeFromParent()
    }

    setLetters()
    {
        const references = this.references.items.get('letters') ?? this.references.items.get('letters.')

        for(const reference of references)
        {
            const physical = reference.userData.object.physical
            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Map',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}
