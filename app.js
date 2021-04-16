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
        './shaders/mandelbrotDoublePrecision.fs.glsl'
        //'./shaders/mandelbrot.fs.glsl'
    ];
    
    getShaderDataAsync(shaderList)
        .then((data) => {        
            console.log(`${data.length} shaders loaded.`);
            document.querySelector('#vsInfo').innerText = data[0];
            document.querySelector('#fsInfo').innerText = data[1];
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
    canvas.onmousemove = onMouseMove;
    

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
        _vpDimensions: gl.getUniformLocation(program, '_vpDimensions'),
        _Area: gl.getUniformLocation(program, '_Area'),
        _AreaR: gl.getUniformLocation(program, '_AreaR'),
        _AreaI: gl.getUniformLocation(program, '_AreaI'),
        _dsInvResolution: gl.getUniformLocation(program, '_dsInvResolution')
    }

    //
    // set cpu-side variables for all of our shader variables
    //
    var vpDimensions = [canvas.width, canvas.height];    
    var area =  [-0.6, 0.0, 0.0, 0.0]; //area(posX, posY, scaleX, scaleY)
    var areaR = [-0.6, 0.0, 0.0, 0.0]; //dsv2(posX, posY)
    var areaI = [ 0.0, 0.0, 0.0, 0.0]; //dsv2(scaleX, scaleY)
    var dsInvResolution = [ 0.0, 0.0, 0.0, 0.0]; //dsv2(1/width, 1/height)
    var scale = 3.0;


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

        //update shader values
        updateShader();
        mandelbrotInfo();
        
        //set clear color and clear buffers
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

        //set uniforms
        gl.uniform2fv(uniforms._vpDimensions, vpDimensions);
        gl.uniform4fv(uniforms._Area, area);
        gl.uniform4fv(uniforms._AreaR, areaR);
        gl.uniform4fv(uniforms._AreaI, areaI);
        gl.uniform4fv(uniforms._dsInvResolution, dsInvResolution);

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
    function doubleToDS(n) {
                
        ds1 = n*100000000;        
        ds1 = n > 0.0 ? Math.floor(ds1) : Math.ceil(ds1);        
        ds1 = ds1 / 100000000;
        
        ds2 = n - ds1;
        
        return [ds1, ds2];
    }

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

    function mandelbrotInfo(){
        document.querySelector('#shaderInfo').innerText = 
        `
            x   : ${area[0]}
            aRx1: ${areaR[0].toFixed(8)}
            aRx2: ${areaR[1]}

            y   : ${area[1]}
            aRy1: ${areaR[2].toFixed(8)}
            aRy2: ${areaR[3]}

           zoom : ${(1/scale).toFixed(2)}
            scl : ${scale}
            aIx : ${areaI[0].toFixed(8)}
            aIy : ${areaI[2].toFixed(8)}

            res : ${vpDimensions[0]} x ${vpDimensions[1]}
        invResX1: ${dsInvResolution[0].toFixed(8)}
        invResY1: ${dsInvResolution[2].toFixed(8)}
        `;
    }

    function updateShader() {
        var aspect = vpDimensions[0] / vpDimensions[1];
        var scaleX = scale;
        var scaleY = scale;
        
        if(aspect > 1.0) {
            scaleY /= aspect;
        } else {
            scaleX *= aspect;
        }

        area[2] = scaleX;
        area[3] = scaleY;

        areaR[0] = doubleToDS(area[0])[0];
        areaR[1] = doubleToDS(area[0])[1];
        areaR[2] = doubleToDS(area[1])[0];
        areaR[3] = doubleToDS(area[1])[1];

        areaI[0] = doubleToDS(scaleX)[0];
        areaI[1] = doubleToDS(scaleX)[1];
        areaI[2] = doubleToDS(scaleY)[0];
        areaI[3] = doubleToDS(scaleY)[1];

        var invResX = 1 / vpDimensions[0];
        var invRexY = 1 / vpDimensions[1];
        dsInvResolution[0] = doubleToDS(invResX)[0];
        dsInvResolution[1] = doubleToDS(invResX)[1];
        dsInvResolution[2] = doubleToDS(invRexY)[0];
        dsInvResolution[3] = doubleToDS(invRexY)[1];
    }

    function onResizeWindow() {
        if(!canvas) return;
    
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        vpDimensions = [canvas.width, canvas.height];
       
        gl.viewport(0, 0, canvas.width, canvas.height);

        //console.log(`window was resized to ${canvas.width}x${canvas.height}`);
    };

    function onZoom(e) {        
        if(e.deltaY < 0) {
            scale = scale * 0.95;
        } else {
            scale = scale * 1.05;
        }
    }

    function onMouseMove(e) {  
        //console.log(e.buttons);
        if(e.buttons === 1) {                        
            //area(posX, posY, scaleX, scaleY)
            var xDelta = (e.movementX / canvas.width) * area[2];
            var yDelta = (e.movementY / canvas.height) * area[3];
            area[0] -= xDelta;
            area[1] += yDelta;
        }
        if(e.buttons === 8) {
            area[0] =-0.934816428;
            area[1] = 0.241485624;
            scale = 0.0000027178;
        }
        if(e.buttons === 16) {
            area[0] =-0.836276;
            area[1] = 0.228855;
            scale = 0.02602319;
        }
    }
};
