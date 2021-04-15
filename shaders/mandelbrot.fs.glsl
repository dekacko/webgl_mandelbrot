//
// Mandelbrot FragmentShader
//

precision highp float;

#define palette(t, a, b, c, d) (a + b*cos(6.2831*(c*t + d)))
#define MAX_ITER 1000
#define AA 3

uniform vec2 viewportDimensions;
uniform vec4 _Area;

uniform float minI;
uniform float maxI;
uniform float minR;
uniform float maxR;

uniform float _time;

//square complex number
vec2 c_pow2(vec2 c)
{
	return vec2(
		c.x * c.x - c.y * c.y,
		2.0 * c.x * c.y
		);
}

void main() {
    float fMAX_ITER = float(MAX_ITER);
    vec2 uv = gl_FragCoord.xy / viewportDimensions.xy;

    vec2 c = _Area.xy + (uv.xy - 0.5 ) * _Area.zw;
    vec2 z;
    float iter;
    for(int i = 0; i < MAX_ITER; i++) {
        iter = float(i);
        z = c_pow2(z) + c;
        if(length(z) > 2.0) break;
    }

    gl_FragColor = vec4(vec3(iter / fMAX_ITER), 1.0);
    //gl_FragColor = vec4(uv.x , uv.y, 0.0, 1.0);
}
