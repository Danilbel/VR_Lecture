AFRAME.registerComponent('kiss-surface', {
    init: function () {
        const zSteps = 50;
        const uSteps = 50;

        const zStart = -1.0;
        const zEnd = 1.0;

        const vertices = [];
        const indices = [];

        for (let i = 0; i <= zSteps; i++) {
            let z = zStart + (i / zSteps) * (zEnd - zStart);

            let safeZ = Math.min(z, 1.0);

            let r = z * z * Math.sqrt(1.0 - safeZ);

            for (let j = 0; j <= uSteps; j++) {
                let u = (j / uSteps) * 2 * Math.PI;

                let x = r * Math.cos(u);
                let y = r * Math.sin(u);

                vertices.push(x, y, z);
            }
        }

        for (let i = 0; i < zSteps; i++) {
            for (let j = 0; j < uSteps; j++) {
                let p0 = i * (uSteps + 1) + j;
                let p1 = p0 + 1;
                let p2 = (i + 1) * (uSteps + 1) + j;
                let p3 = p2 + 1;

                indices.push(p0, p2, p1);
                indices.push(p1, p2, p3);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: 0x9b59b6,
            side: THREE.DoubleSide,
            roughness: 0.6,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);

        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true
        });
        const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
        mesh.add(wireframeMesh);

        mesh.scale.set(0.4, 0.4, 0.4);
        mesh.rotation.x = -Math.PI / 2;

        this.el.setObject3D('mesh', mesh);
    }
});
