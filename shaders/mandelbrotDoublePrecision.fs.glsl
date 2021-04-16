//
// Mandelbrot FragmentShader
//

precision highp float;

#define palette(t, a, b, c, d) (a + b*cos(6.2831*(c*t + d)))
#define MAX_ITER 1500
#define AA 3
#define RADIUS 2.
#define DS_MANDEL 1.

uniform vec2 _vpDimensions;
uniform vec4 _Area;
uniform vec4 _AreaR;
uniform vec4 _AreaI;
uniform vec4 _dsInvResolution;

uniform float _time;

//
// emulated doubles (double singles)
//
//double from single
vec2 ds_set(float a)
{
    vec2 z;
    
    z.x = a;
    z.y = 0.0;

    return z;
}

//ds addition
vec2 ds_add(vec2 dsa, vec2 dsb)
{
    vec2 dsc;
    float t1, t2, e;
    
    t1 = dsa.x + dsb.x;
    e = t1 - dsa.x;
    t2 = ((dsb.x - e) + (dsa.x - (t1 -e))) + dsa.y + dsb.y;

    dsc.x = t1 + t2;
    dsc.y = t2 - (dsc.x - t1);

    return dsc;
}

//ds subrtaction
vec2 ds_sub(vec2 dsa, vec2 dsb)
{
    vec2 dsc;
    float t1, t2, e;
    
    t1 = dsa.x + dsb.x;
    e = t1 - dsa.x;
    t2 = ((- dsb.x - e) + (dsa.x - (t1 -e))) + dsa.y - dsb.y;

    dsc.x = t1 + t2;
    dsc.y = t2 - (dsc.x - t1);

    return dsc;
}

//ds multiplication
vec2 ds_mul (vec2 dsa, vec2 dsb)
{
    vec2 dsc;
    float c11, c21, c2, e, t1, t2;
    float a1, a2, b1, b2, cona, conb, split = 8193.0;

    cona = dsa.x * split;
    conb = dsb.x * split;
    a1 = cona - (cona - dsa.x);
    b1 = conb - (conb - dsb.x);
    a2 = dsa.x - a1;
    b2 = dsb.x - b1;

    c11 = dsa.x * dsb.x;
    c21 = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));

    c2 = dsa.x * dsb.y + dsa.y * dsb.x;

    t1 = c11 + c2;
    e = t1 - c11;
    t2 = dsa.y * dsb.y + ((c2 - e) + (c11 - (t1 - e))) + c21;

    dsc.x = t1 + t2;
    dsc.y = t2 - (dsc.x - t1);

    return dsc;
}

//ds compare
// -1 a < b
//  0 a == b 
//  1 a > b
float ds_compare(vec2 dsa, vec2 dsb)
{
    if(dsa.x < dsb.x) return -1.0;
    if(dsa.x == dsb.x){
        if(dsa.y < dsb.y) return -1.0;
        else if(dsa.y == dsb.y) return 0.0;
        else return 1.0;
    }
    else return 1.0;
}

//ds vec2
vec4 dsv2_set(vec2 dsa, vec2 dsb)
{
    return vec4(dsa, dsb);
}

vec4 dsv2_set(float a, float b)
{
    vec2 dsa = ds_set(a);
    vec2 dsb = ds_set(b);
    return vec4(dsa, dsb);
}

//dsv2 addition
vec4 dsv2_add(vec4 dsv2a, vec4 dsv2b)
{
    vec2 dsv2x = ds_add(dsv2a.xy, dsv2b.xy);
    vec2 dsv2y = ds_add(dsv2a.zw, dsv2b.zw);
    return vec4(dsv2x, dsv2y);
}

//dsv2 multiplication
vec4 dsv2_mul(vec4 dsv2a, vec4 dsv2b)
{
    vec2 dsv2x = ds_mul(dsv2a.xy, dsv2b.xy);
    vec2 dsv2y = ds_mul(dsv2a.zw, dsv2b.zw);
    return vec4(dsv2x, dsv2y);
}

//dsv2 square complex
vec4 dsv2_cpow2(vec4 c)
{
    vec2 ds_2 = ds_set(2.0);

    vec2 dsv2x = ds_sub(ds_mul(c.xy, c.xy), ds_mul(c.zw, c.zw));
    vec2 dsv2y = ds_mul(ds_2, ds_mul(c.xy, c.zw));
    return vec4(dsv2x, dsv2y);
}


//square complex number
vec2 c_pow2(vec2 c)
{
	return vec2(
		c.x * c.x - c.y * c.y,
		2.0 * c.x * c.y
		);
}

//mandelbrot
float mandelbrot(vec2 uv) {
    vec2 c = _Area.xy + (uv.xy - 0.5 ) * _Area.zw;
    vec2 z;    
    for(int i = 0; i < MAX_ITER; i++) {        
        z = c_pow2(z) + c;
        if(length(z) > RADIUS) {
            //return (float(i) + 1. - log(log(length(z)))/log(2.));	// http://linas.org/art-gallery/escape/escape.html
            return float(i);
        };
    }
    return 0.0;
}

//mandelbrot ds
float dsMandelbrot(vec2 _uv) {
    vec2 ds_radius2 = ds_set(RADIUS * RADIUS);

    vec2 uv_mov = _uv.xy - 0.5;
    vec4 uv = dsv2_set(uv_mov.x, uv_mov.y);

    vec4 c = dsv2_add(_AreaR, dsv2_mul(uv, _AreaI));  

    vec4 z = c;
    for(int i = 0; i < MAX_ITER; i++) {        
        z = dsv2_add(dsv2_cpow2(z), c); // c_pow2(z) + c;
        if( ds_compare(ds_add(ds_mul(z.xy,z.xy),ds_mul(z.zw,z.zw)), ds_radius2) > 0.0) {
            return (float(i) + 1. - log(log(length(z)))/log(2.));	// http://linas.org/art-gallery/escape/escape.html
            //return float(i);
        };
    }
    return 0.0;
}

//mandelbrot ds - ds_uv input
float dsMandelbrot(vec4 _uv) {
    vec2 ds_radius2 = ds_set(RADIUS * RADIUS);

    //vec2 uv_mov = _uv.xy - 0.5;
    //vec4 uv = dsv2_set(uv_mov.x, uv_mov.y);
    vec4 uv = dsv2_add(_uv, dsv2_set(-0.5,-0.5));

    vec4 c = dsv2_add(_AreaR, dsv2_mul(uv, _AreaI));  

    vec4 z = c;
    for(int i = 0; i < MAX_ITER; i++) {        
        z = dsv2_add(dsv2_cpow2(z), c); // c_pow2(z) + c;
        if( ds_compare(ds_add(ds_mul(z.xy,z.xy),ds_mul(z.zw,z.zw)), ds_radius2) > 0.0) {
            return (float(i) + 1. - log(log(length(vec2(z.x, z.z))))/log(2.));	// http://linas.org/art-gallery/escape/escape.html
            //return float(i);
        };
    }
    return 0.0;
}

void main() {     
    float n;  
    if(DS_MANDEL < 1.) {
        vec2 uv = gl_FragCoord.xy / _vpDimensions.xy;
        n = mandelbrot(uv);
        //float n = dsMandelbrot(uv);
    }else{
        vec4 ds_FragCoord = dsv2_set(gl_FragCoord.x, gl_FragCoord.y);
        vec4 ds_uv = dsv2_mul(ds_FragCoord, _dsInvResolution);
        n = dsMandelbrot(ds_uv);
    }

    /* vec3 c = vec3(
        (-cos(0.025*n)+1.0)/2.0, 
		(-cos(0.08*n)+1.0)/2.0, 
		(-cos(0.12*n)+1.0)/2.0
        );
    gl_FragColor = vec4(c, 1.0); */

    float c = pow(n, 1.7) / float(MAX_ITER);
    gl_FragColor = vec4(vec3(c), 1.0);
    //gl_FragColor = vec4(uv.x , uv.y, 0.0, 1.0);
}
