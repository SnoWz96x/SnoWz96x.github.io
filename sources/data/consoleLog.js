import * as THREE from 'three/webgpu'
import socialData from './social.js'

const socialLines = socialData
    .map((item) =>
    {
        const target = item.url || (item.modal ? `modal:${item.modal}` : '')
        return target ? `║ ${item.name.padEnd(14)} ⇒ ${target}` : null
    })
    .filter(Boolean)
    .join('\n')

const text = `
 █████╗ ██╗     ██╗      █████╗ ███╗   ██╗
██╔══██╗██║     ██║     ██╔══██╗████╗  ██║
███████║██║     ██║     ███████║██╔██╗ ██║
██╔══██║██║     ██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗███████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝

 █████╗ ██╗  ████████╗ █████╗ ██████╗ ██╗   ██╗ ██████╗ ██╗ ██████╗
██╔══██╗██║  ╚══██╔══╝██╔══██╗██╔══██╗██║   ██║██╔════╝ ██║██╔═══██╗
███████║██║     ██║   ███████║██████╔╝██║   ██║██║  ███╗██║██║   ██║
██╔══██║██║     ██║   ██╔══██║██╔══██╗██║   ██║██║   ██║██║██║   ██║
██║  ██║███████╗██║   ██║  ██║██║  ██║╚██████╔╝╚██████╔╝██║╚██████╔╝
╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝ ╚═════╝

╔═ Intro ═══════════════╗
║ Thank you for visiting Allan Altarugio's portfolio.
║ This world will be customized with my projects and experiments.
╚═══════════════════════╝

╔═ Socials ═════════════╗
${socialLines}
╚═══════════════════════╝

╔═ Debug ═══════════════╗
║ You can access the debug mode by adding #debug at the end of the URL and reloading.
║ Press [V] to toggle the free camera.
╚═══════════════════════╝

╔═ Three.js ════════════╗
║ Three.js is the library used to render this 3D world (release: ${THREE.REVISION})
║ https://threejs.org/
║ TSL enables this portfolio to work across WebGL and WebGPU rendering paths.
╚═══════════════════════╝

╔═ Source code ═════════╗
║ The public project works without the private server.
╚═══════════════════════╝

╔═ Some more links ═════╗
║ Rapier (Physics library)  ⇒ https://rapier.rs/
║ Howler.js (Audio library) ⇒ https://howlerjs.com/
║ Amatic SC (Fonts)         ⇒ https://fonts.google.com/specimen/Amatic+SC
║ Nunito (Fonts)            ⇒ https://fonts.google.com/specimen/Nunito?query=Nunito
╚═══════════════════════╝
`

let finalText = ''
const finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null

for(let i = 0; i < text.length; i++)
{
    const char = text[i]
    const style = char.match(/[╔║═╗╚╝]/) ? 'pipe' : 'letter'

    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'
        finalStyles.push(stylesSet[currentStyle])
    }

    finalText += char
}

export default [finalText, ...finalStyles]
