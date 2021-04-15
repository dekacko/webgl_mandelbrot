//
// Mandelbrot FragmentShader
//

precision highp float;

uniform vec2 viewportDimensions;
uniform float minI;
uniform float maxI;
uniform float minR;
uniform float maxR;

#define palette(t, a, b, c, d) (a + b*cos(6.2831*(c*t + d)))

void main() {

    vec2 c = vec2(
        gl_FragCoord.x * (maxR - minR) / viewportDimensions.x + minR,
        gl_FragCoord.y * (maxI - minI) / viewportDimensions.y + minI
    );

    //mandelbrot formula
    vec2 z = c;
    float iterations = 0.0;
    float maxIterations = 2000.0;
    const int imaxIterations = 2000;

    for(int i = 0; i < imaxIterations; i++){
        float t = 2.0 * z.x * z.y + c.y;
        z.x = z.x * z.x - z.y * z.y + c.x;
        z.y = t;

        if(z.x * z.x + z.y * z.y > 4000.0) {
            break;
        }

        iterations += 1.0;
    }

    if(iterations < maxIterations) {
        float col = pow(iterations,2.3) / maxIterations;
        
        gl_FragColor = vec4(col, 0.0, 1.0-col, 1.0);
    } else {
        discard;
    }
}
