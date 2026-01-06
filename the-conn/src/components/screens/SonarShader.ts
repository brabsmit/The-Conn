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
uniform vec2 uResolution;

void main(void) {
    // Invert the offset direction
    float bufferY = (vTextureCoord.y * -1.0) + (uScanline / uResolution.y);

    // Handle wrap-around for negative values
    if (bufferY < 0.0) bufferY += 1.0;

    gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, bufferY));
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
