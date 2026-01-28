/**
 * Three.js 3D Viewer Module
 * Suporta STL, OBJ, GLB/GLTF, 3MF
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

export class ThreeViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentMesh = null;
        this.gridHelper = null;
        this.wireframeMode = false;
        this.gridVisible = true;
        this.animationId = null;
        this.boundingBox = null;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e1a);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.updateSize();

        // Camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        this.camera.position.set(150, 150, 150);

        // Controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 5000;
        this.controls.enablePan = true;
        this.controls.panSpeed = 0.8;

        // Lighting
        this.setupLighting();

        // Grid
        this.setupGrid();

        // Start animation loop
        this.animate();

        // Resize handler
        this.resizeObserver = new ResizeObserver(() => this.updateSize());
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(1, 1, 1);
        this.scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.3);
        fillLight.position.set(-1, -1, -1);
        this.scene.add(fillLight);

        // Top light
        const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
        topLight.position.set(0, 1, 0);
        this.scene.add(topLight);
    }

    setupGrid() {
        this.gridHelper = new THREE.GridHelper(300, 30, 0x444444, 0x222222);
        this.gridHelper.material.opacity = 0.5;
        this.gridHelper.material.transparent = true;
        this.scene.add(this.gridHelper);
    }

    updateSize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width === 0 || height === 0) return;

        this.canvas.width = width;
        this.canvas.height = height;

        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }

    async loadFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const url = URL.createObjectURL(file);

        try {
            let result;

            switch (ext) {
                case 'stl':
                    result = await this.loadSTL(url);
                    break;
                case 'obj':
                    result = await this.loadOBJ(url);
                    break;
                case 'glb':
                case 'gltf':
                    result = await this.loadGLTF(url);
                    break;
                case '3mf':
                    result = await this.load3MF(url);
                    break;
                default:
                    throw new Error('Formato nao suportado');
            }

            this.displayGeometry(result.geometry, result.material);
            return result.geometry;

        } finally {
            URL.revokeObjectURL(url);
        }
    }

    loadSTL(url) {
        return new Promise((resolve, reject) => {
            const loader = new STLLoader();
            loader.load(
                url,
                (geometry) => {
                    resolve({ geometry, material: null });
                },
                undefined,
                reject
            );
        });
    }

    loadOBJ(url) {
        return new Promise((resolve, reject) => {
            const loader = new OBJLoader();
            loader.load(
                url,
                (obj) => {
                    let geometry = null;
                    let material = null;

                    obj.traverse((child) => {
                        if (child.isMesh && !geometry) {
                            geometry = child.geometry;
                            material = child.material;
                        }
                    });

                    if (!geometry) {
                        reject(new Error('Nenhuma geometria encontrada no OBJ'));
                        return;
                    }

                    resolve({ geometry, material });
                },
                undefined,
                reject
            );
        });
    }

    loadGLTF(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    let geometry = null;
                    let material = null;

                    gltf.scene.traverse((child) => {
                        if (child.isMesh && !geometry) {
                            geometry = child.geometry;
                            material = child.material;
                        }
                    });

                    if (!geometry) {
                        reject(new Error('Nenhuma geometria encontrada no GLTF'));
                        return;
                    }

                    resolve({ geometry, material });
                },
                undefined,
                reject
            );
        });
    }

    load3MF(url) {
        return new Promise((resolve, reject) => {
            const loader = new ThreeMFLoader();
            loader.load(
                url,
                (obj) => {
                    let geometry = null;
                    let material = null;

                    obj.traverse((child) => {
                        if (child.isMesh && !geometry) {
                            geometry = child.geometry;
                            material = child.material;
                        }
                    });

                    if (!geometry) {
                        reject(new Error('Nenhuma geometria encontrada no 3MF'));
                        return;
                    }

                    resolve({ geometry, material });
                },
                undefined,
                reject
            );
        });
    }

    displayGeometry(geometry, existingMaterial = null) {
        // Remove existing mesh
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            if (this.currentMesh.geometry) {
                this.currentMesh.geometry.dispose();
            }
            if (this.currentMesh.material) {
                if (Array.isArray(this.currentMesh.material)) {
                    this.currentMesh.material.forEach(m => m.dispose());
                } else {
                    this.currentMesh.material.dispose();
                }
            }
        }

        // Compute normals if needed
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        // Create material
        const material = new THREE.MeshPhongMaterial({
            color: 0x00d4ff,
            specular: 0x222222,
            shininess: 30,
            flatShading: false,
            side: THREE.DoubleSide
        });

        // Create mesh
        this.currentMesh = new THREE.Mesh(geometry, material);

        // Center geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Position mesh so bottom is at grid level
        const box = new THREE.Box3().setFromObject(this.currentMesh);
        const minY = box.min.y;
        this.currentMesh.position.y = -minY;

        this.scene.add(this.currentMesh);

        // Store bounding box
        this.boundingBox = new THREE.Box3().setFromObject(this.currentMesh);

        // Update grid size
        this.updateGridSize();

        // Fit camera
        this.fitCameraToObject();
    }

    updateGridSize() {
        if (!this.boundingBox || !this.gridHelper) return;

        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const gridSize = Math.ceil(maxDim * 1.5 / 10) * 10;

        this.scene.remove(this.gridHelper);
        this.gridHelper = new THREE.GridHelper(
            Math.max(gridSize, 100),
            Math.max(gridSize / 10, 10),
            0x444444,
            0x222222
        );
        this.gridHelper.material.opacity = 0.5;
        this.gridHelper.material.transparent = true;
        this.gridHelper.visible = this.gridVisible;
        this.scene.add(this.gridHelper);
    }

    fitCameraToObject() {
        if (!this.currentMesh || !this.boundingBox) return;

        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        const fov = this.camera.fov * (Math.PI / 180);
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;

        const center = new THREE.Vector3();
        this.boundingBox.getCenter(center);

        this.camera.position.set(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7
        );

        this.controls.target.copy(center);
        this.controls.update();
    }

    getBoundingBox() {
        if (!this.boundingBox) return null;

        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);

        return {
            width: size.x,
            height: size.y,
            depth: size.z
        };
    }

    rotateModel() {
        if (!this.currentMesh) return;

        // Rotaciona 90 graus no eixo X (levanta modelo deitado)
        this.currentMesh.rotation.x -= Math.PI / 2;

        // Recalcular bounding box e reposicionar no grid
        this.boundingBox = new THREE.Box3().setFromObject(this.currentMesh);
        const minY = this.boundingBox.min.y;
        this.currentMesh.position.y -= minY;

        // Atualizar bounding box final
        this.boundingBox = new THREE.Box3().setFromObject(this.currentMesh);
        this.updateGridSize();
        this.fitCameraToObject();
    }

    resetCamera() {
        this.fitCameraToObject();
    }

    toggleWireframe() {
        if (!this.currentMesh) return;

        this.wireframeMode = !this.wireframeMode;
        this.currentMesh.material.wireframe = this.wireframeMode;

        return this.wireframeMode;
    }

    toggleGrid() {
        if (!this.gridHelper) return;

        this.gridVisible = !this.gridVisible;
        this.gridHelper.visible = this.gridVisible;

        return this.gridVisible;
    }

    setMeshColor(colorHex) {
        if (!this.currentMesh) return;
        this.currentMesh.material.color.setHex(colorHex);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this.currentMesh.geometry?.dispose();
            this.currentMesh.material?.dispose();
        }

        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper.geometry?.dispose();
            this.gridHelper.material?.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        if (this.controls) {
            this.controls.dispose();
        }
    }
}
