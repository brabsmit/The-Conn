import { Filter } from 'pixi.js';

const vertex = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

const fragment = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform float uScanline;
uniform float uTime;
uniform vec2 uResolution;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main(void) {
    vec2 uv = vTextureCoord;

    // Scrolling Logic
    // uScanline is the current scanline index (0..height).
    // Logic provided in task: y = uv.y + (uScanline / uResolution.y)
    // We wrap y if it exceeds 1.0.

    float y = vTextureCoord.y + (uScanline / uResolution.y);
    if (y > 1.0) y -= 1.0;

    vec4 color = texture2D(uSampler, vec2(vTextureCoord.x, y));

    // Analog Noise
    color.rgb += random(uv * 10.0 + uTime) * 0.1;

    // Scanlines
    color.rgb *= 0.9 + 0.1 * sin(uv.y * 800.0);

    // Phosphor Decay (Green Tint)
    // Use max channel for intensity
    float val = max(color.r, max(color.g, color.b));
    gl_FragColor = vec4(0.0, val, 0.0, 1.0);
}
`;

export class SonarSweepFilter extends Filter {
    constructor() {
        super(vertex, fragment);
        this.uniforms.uScanline = 0;
        this.uniforms.uTime = 0;
        this.uniforms.uResolution = [100, 100];
    }
}
