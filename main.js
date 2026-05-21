'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let surfaceWebCam;              // A substrate for webcam image
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = null;

let video;

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the vertex attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the texture coordinate attribute variable in the shader program.
    this.iAttribTexCoords = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    // Location of the uniform matrix representing the modelview transformation
    this.iModelViewMatrix = -1;
    // Location of the TMU0
    this.iTMU0 = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1i(shProgram.iTMU0, 0);

    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM

    if (iTextureWebCam) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0,0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    let matrOrth = m4.orthographic(0, 1, 0, 1, -1, 1);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrOrth);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.identity());

    // Render in full color (no red/cyan filter) for zero parallax
    gl.colorMask(true, true, true, true);
    gl.uniform1i(shProgram.bUseTexture, 1);
    
    if (iTextureWebCam) {
        surfaceWebCam.idTextureDiffuse = iTextureWebCam;
        surfaceWebCam.Draw();
    }

    // Clear the depth buffer so the 3D model renders properly on top of the webcam feed
    gl.clear(gl.DEPTH_BUFFER_BIT);

    
    /* Get the view matrix from the SimpleRotator object.*/
    let trackballMatrix = spaceball.getViewMatrix();
    // Combine the trackball rotation with the sensor rotation
    let modelView = m4.multiply(trackballMatrix, sensorRotationMatrix);
    
    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    const colorPolygon = new Float32Array([0.5,0.5,0.5,1]);
    const colorEdge    = new Float32Array([1,1,1,1]);

    // The FIRST PASS (for the left eye)

    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4. translation(stereoCam.eyeSeparation/2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1 );
        
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,0);

    gl.uniform1i(shProgram.bUseTexture, 0 );
    
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4. translation(-stereoCam.eyeSeparation/2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    matAccum2 = m4.multiply(translateToPointZero, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // RESET specific params to their default state

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoords           = gl.getAttribLocation(prog, "tex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");
    shProgram.bUseTexture                = gl.getUniformLocation(prog, "bUseTexture");
   
    shProgram.iTMU0                      = gl.getUniformLocation(prog, "iTMU0");

    let data = {};
    
    CreateSurfaceData(data)

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16, data.texcoordsF32);

    surfaceWebCam = new Model('SurfaceWebCam');
    let webCamData = {
        // A flat quad covering the screen coordinates (0 to 1)
        verticesF32: new Float32Array([
            0.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            1.0, 1.0, 0.0
        ]),
        texcoordsF32: new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            1.0, 0.0
        ]),
        indicesU16: new Uint16Array([
            0, 1, 2, 
            2, 1, 3
        ])
    };
    surfaceWebCam.BufferData(webCamData.verticesF32, webCamData.indicesU16, webCamData.texcoordsF32);

    stereoCam = new StereoCamera(
        .7,     // decimeters
        14.0,   // decimeters
        1.3,    // aspect ratio of canvas
        0.4,    // radians
        8.0,    // decimeters
        20.0    // decimeters
    );

    surface.idTextureDiffuse  = LoadTexture();

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        video.oncanplay = function () {
            console.log("Video object is ready to render frames");
            iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);
        };

        // Fired when the browser has metadata (width, height, duration, etc.)
        video.onloadedmetadata = function () {
            console.log("Video object metadata is loaded:", video.videoWidth, video.videoHeight);
            video.play();
        };
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    }
    );

    setInterval(draw, 1/20);

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}

window.updateParams = function() {
    stereoCam.eyeSeparation = parseFloat(document.getElementById("eyeSep").value);
    document.getElementById("eyeSepVal").innerText = stereoCam.eyeSeparation;

    stereoCam.FOV = parseFloat(document.getElementById("fov").value);
    document.getElementById("fovVal").innerText = stereoCam.FOV;

    stereoCam.nearClippingDistance = parseFloat(document.getElementById("nearClip").value);
    document.getElementById("nearClipVal").innerText = stereoCam.nearClippingDistance;

    stereoCam.convergence = parseFloat(document.getElementById("convergence").value);
    document.getElementById("convergenceVal").innerText = stereoCam.convergence;
    
    draw();
}

window.resetParameters = function() {
    document.getElementById("eyeSep").value = 0.7;
    document.getElementById("fov").value = 0.4;
    document.getElementById("nearClip").value = 8.0;
    document.getElementById("convergence").value = 14.0;
    updateParams();
}

let sensorRotationMatrix = m4.identity();
let sensorSocket = null;

function processOrientation(values) {
    // values[0] = Azimuth (Z)
    // values[1] = Pitch (X)
    // values[2] = Roll (Y)
    // degrees to radians
    let azimuth = values[0] * (Math.PI / 180.0);
    let pitch = values[1] * (Math.PI / 180.0);
    let roll = values[2] * (Math.PI / 180.0);

    let matZ = m4.zRotation(azimuth);
    let matX = m4.xRotation(pitch);
    let matY = m4.yRotation(roll);

    //  ZXY: Matrix = Z * X * Y
    let matZX = m4.multiply(matZ, matX);
    sensorRotationMatrix = m4.multiply(matZX, matY);
}

function setSensorStatus(msg, color) {
    const el = document.getElementById('sensor-status');
    if (el) {
        el.textContent = msg;
        if (color) el.style.color = color;
    }
}

window.toggleConnection = function() {
    let btn = document.getElementById("btnConnect");
    let wsServer = document.getElementById("wsServer").value;

    if (sensorSocket && sensorSocket.readyState === WebSocket.OPEN) {
        sensorSocket.close();
        return;
    }

    const url = `ws://${wsServer}/sensor/connect?type=android.sensor.orientation`;
    
    setSensorStatus('Connecting...', '#f39c12');
    btn.innerText = "Connecting...";

    try {
        sensorSocket = new WebSocket(url);
    } catch (e) {
        setSensorStatus('Error: ' + e.message, '#e74c3c');
        btn.innerText = "Connect to Phone";
        return;
    }

    sensorSocket.onopen = function() {
        setSensorStatus('Connected', '#2ecc71');
        btn.innerText = "Disconnect";
        btn.style.backgroundColor = "#dc3545"; 
        sensorRotationMatrix = m4.identity();
    };

    sensorSocket.onmessage = function(event) {
        try {
            let msg = JSON.parse(event.data);
            if (msg.values && msg.values.length >= 3) {
                processOrientation(msg.values);
            }
        } catch (e) {
            console.error("Data parsing error:", e);
        }
    };

    sensorSocket.onerror = function() {
        setSensorStatus('Connection error', '#e74c3c');
    };

    sensorSocket.onclose = function() {
        setSensorStatus('Disconnected', '#e74c3c');
        btn.innerText = "Connect to Phone";
        btn.style.backgroundColor = "#28a745";
        sensorSocket = null;
    };
}