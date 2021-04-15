const loadShaderRequest = (shaderUrl) => {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', shaderUrl);
        xhr.onload = () => {
            if(xhr.status >= 200 && xhr.status < 300){
                resolve(xhr.response);
            } else {
                reject(xhr.statusText);
            }
        };
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
    });
};

const getShaderDataAsync = async (list) => {
    return Promise.all(list.map(shaderUrl => loadShaderRequest(shaderUrl)));
};

const init = () => {
    const shaderList = [
        './shaders/mandelbrot.vs.glsl',
        './shaders/mandelbrot.fs.glsl'
    ];
    
    getShaderDataAsync(shaderList)
        .then((data) => {        
            console.log(`${data.length} shaders loaded.`);
            document.querySelector('#vs').innerText = data[0];
            document.querySelector('#fs').innerText = data[1];
            runDemo({
                vsText: data[0],
                fsText: data[1]
            });
        })
        .catch((err) => {
            console.log('error loading shaders:');
            console.log(err);
        });
};

var canvas, gl;

const runDemo = (loadedShaders) => {
    canvas = document.querySelector('#gl-surface');
    //
    // Attach callbacks
    //
    window.onresize = onResizeWindow;
    window.onwheel = onZoom;    
    window.onmousemove = onMouseMove;

    //
    // canvas context
    //
    gl = canvas.getContext('webgl');

    if(!gl) {
        console.log('webgl not available - falling back on experimental');
        gl = canvas.getContext('experimental-webgl');
    }
    if(!gl) {
        alert('cannot get webgl context - browser does not support webgl');
        return;
    }   

    //
    // create shader program
    //
    var vs = gl.createShader(gl.VERTEX_SHADER);    
    gl.shaderSource(vs, loadedShaders.vsText);
    gl.compileShader(vs);
    if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(`Vertex shader compile error:`);
        console.error(gl.getShaderInfoLog(vs));
    }

    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, loadedShaders.fsText);
    gl.compileShader(fs);
    if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(`Fragment shader compile error:`);
        console.error(gl.getShaderInfoLog(fs));
    }

    //
    // create program
    //
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error('Shader program link error:');
        gl.getShaderInfoLog(program);
    }

    //
    // validate program
    //
    gl.validateProgram(program);
    if(!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('Shader program validate error:');
        gl.getShaderInfoLog(program);
    }

    //
    // use program
    //
    gl.useProgram(program);

    //
    // get uniform locations
    //
    var uniforms = {
        viewportDimensions: gl.getUniformLocation(program, 'viewportDimensions'),
        _Area: gl.getUniformLocation(program, '_Area'),
        minI: gl.getUniformLocation(program,'minI'),
        maxI: gl.getUniformLocation(program,'maxI'),
        minR: gl.getUniformLocation(program,'minR'),
        maxR: gl.getUniformLocation(program,'maxR')
    }

    //
    // set cpu-side variables for all of our shader variables
    //
    var vpDimensions = [canvas.width, canvas.height];
    var area = [0.0, 0.0, 4.0, 4.0];
    var minI = -2.0;
    var maxI =  2.0;
    var minR = -2.0;
    var maxR =  2.0;

    //
    // create buffers => for fragment shaders we need only fullscreen quad (2 triangles)
    //
    var vertexBuffer = gl.createBuffer();
    var vertices = [
        -1,  1,
        -1, -1,
         1, -1,
        
        -1,  1,
         1,  1,
         1, -1 
    ];

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    var vPosAttrib = gl.getAttribLocation(program, 'vPos');
    gl.vertexAttribPointer(
        vPosAttrib,
        2, gl.FLOAT,
        gl.FALSE,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
    );
    gl.enableVertexAttribArray(vPosAttrib);
    
    //
    // Main loop
    //
    
    
    const loop = () => {
        // fps info
        fpsInfo();
        
        //set clear color and clear buffers
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

        //set uniforms
        gl.uniform2fv(uniforms.viewportDimensions, vpDimensions);
        gl.uniform4fv(uniforms._Area, area);
        gl.uniform1f(uniforms.minI, minI);
        gl.uniform1f(uniforms.maxI, maxI);
        gl.uniform1f(uniforms.minR, minR);
        gl.uniform1f(uniforms.maxR, maxR);

        //draw polygons
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        //loop
        requestAnimationFrame(loop);
        onResizeWindow();
    };

    

    //
    // start main loop
    //
    requestAnimationFrame(loop);

    //
    // utils
    //
    var thisframetime;
    var lastframetime = performance.now();
    var dt;
    var frames = [];
    var lastPrintTime = performance.now();
    var reducer = (acc, val) => acc + val;

    function fpsInfo() {
        thisframetime = performance.now();
        dt = thisframetime - lastframetime;
        lastframetime = thisframetime;
        frames.push(dt);
        if(lastPrintTime + 750 < thisframetime) {
            lastPrintTime = thisframetime;
            var average = frames.reduce(reducer);
            average /= frames.length;
            document.title = `${(1000.0 / average).toFixed(2) } FPS`;
        }
        frames = frames.slice(0,250);
    }

    function onResizeWindow() {
        if(!canvas) return;
    
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        vpDimensions = [canvas.width, canvas.height];

        var oldRealRange = maxR - minR;
        maxR = (maxI - minI) * (canvas.width / canvas.height) + minR;
        var newRealRange = maxR - minR;

        minR -= (newRealRange - oldRealRange) / 2;
        maxR = (maxI - minI) * (canvas.width / canvas.height) + minR;
        
        gl.viewport(0, 0, canvas.width, canvas.height);

        //console.log(`window was resized to ${canvas.width}x${canvas.height}`);
    };

    function onZoom(e) {
        var imaginaryRange = maxI - minI;
        var newRange;
        if(e.deltaY < 0) {
            newRange = imaginaryRange * 0.95;
        } else {
            newRange = imaginaryRange * 1.05;
        }

        var delta = newRange - imaginaryRange;

        minI -= delta / 2;
        maxI = minI + newRange;

        onResizeWindow();
    }

    function onMouseMove(e) {        
        if(e.buttons === 1) {
            //console.log(e);
            var iRange = maxI - minI;
            var rRange = maxR - minR;

            var iDelta = (e.movementY / canvas.height) * iRange;
            var rDelta = (e.movementX / canvas.width) * rRange;

            minI += iDelta;
            maxI += iDelta;
            minR -= rDelta;
            maxR -= rDelta;
        }
    }
};
