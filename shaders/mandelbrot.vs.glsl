//
// Mandelbrot VertexShader
//

precision highp float;

attribute vec2 vPos;

void main() {
    gl_Position = vec4(vPos, 0.0, 1.0);
}

//ve vertex shaderu zkusit predat do fragment shaderu double single uv koordinaty
//a pak uz se na to asik vysrat

