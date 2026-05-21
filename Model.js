

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// p: an array of xyz vertex coords
// t: an array of uv tex coords
function Vertex(p,t)
{
    this.p = p;
    this.t = t;
    this.normal = [];
    this.triangles = [];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.normal = [];
    this.tangent = [];
}

// Model Constructor function
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTexCoordsBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    // Identifier of a diffuse texture
    this.idTextureDiffuse  = -1;

    this.BufferData = function(vertices, indices, texCoords) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoords);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);

        //gl.drawArrays(gl.LINE_STRIP, 0, this.count);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.DrawWireframe = function() {

        for (let p=0; p<this.count; p+=3)                    // offset in bytes (UNSIGNED_SHORT is two bytes)
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, p*2);
    }
}

function CreateSurfaceData(data) {
    let vertices = [];
    let triangles = [];

    const zSteps = 50;
    const uSteps = 50;
    
    const zStart = -1.0;
    const zEnd = 1.0;

    // 1. Генеруємо вершини
    for (let i = 0; i <= zSteps; i++) {
        let z = zStart + (i / zSteps) * (zEnd - zStart);
        
        // Запобігаємо появі від'ємного числа під коренем через похибки float
        let safeZ = Math.min(z, 1.0);
        
        // Радіус за заданою формулою: r(z) = z^2 * sqrt(1-z)
        let r = (z * z) * Math.sqrt(1.0 - safeZ);

        for (let j = 0; j <= uSteps; j++) {
            let u = (j / uSteps) * 2 * Math.PI;

            // Координати x та y
            let x = r * Math.cos(u);
            let y = r * Math.sin(u);

            // Текстурні координати (U, V)
            let texU = j / uSteps;
            let texV = i / zSteps;

            vertices.push(new Vertex([x, y, z], [texU, texV]));
        }
    }

    // 2. Генеруємо полігони (трикутники)
    for (let i = 0; i < zSteps; i++) {
        for (let j = 0; j < uSteps; j++) {
            let p0 = i * (uSteps + 1) + j;
            let p1 = p0 + 1;
            let p2 = (i + 1) * (uSteps + 1) + j;
            let p3 = p2 + 1;

            triangles.push(new Triangle(p0, p2, p1));
            triangles.push(new Triangle(p1, p2, p3));
        }
    }

    // 3. Заповнюємо буфери
    data.verticesF32 = new Float32Array(vertices.length * 3);
    data.texcoordsF32 = new Float32Array(vertices.length * 2);
    for (let i = 0; i < vertices.length; i++) {
        data.verticesF32[i * 3 + 0] = vertices[i].p[0];
        data.verticesF32[i * 3 + 1] = vertices[i].p[1];
        data.verticesF32[i * 3 + 2] = vertices[i].p[2];

        data.texcoordsF32[i * 2 + 0] = vertices[i].t[0];
        data.texcoordsF32[i * 2 + 1] = vertices[i].t[1];
    }

    data.indicesU16 = new Uint16Array(triangles.length * 3);
    for (let i = 0; i < triangles.length; i++) {
        data.indicesU16[i * 3 + 0] = triangles[i].v0;
        data.indicesU16[i * 3 + 1] = triangles[i].v1;
        data.indicesU16[i * 3 + 2] = triangles[i].v2;
    }
}