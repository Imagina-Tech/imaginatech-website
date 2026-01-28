/**
 * Volume Calculator Module
 * Calcula volume de geometrias 3D usando tetraedros assinados
 */

import * as THREE from 'three';

/**
 * Calcula o volume de uma BufferGeometry usando o metodo de tetraedros assinados
 * @param {THREE.BufferGeometry} geometry - Geometria do Three.js
 * @returns {number} Volume em unidades cubicas (mesma unidade do modelo)
 */
export function calculateVolumeFromGeometry(geometry) {
    if (!geometry) return 0;

    const position = geometry.getAttribute('position');
    if (!position) return 0;

    const index = geometry.getIndex();
    let volume = 0;

    const triCount = index ? index.count / 3 : position.count / 3;

    for (let i = 0; i < triCount; i++) {
        let i0, i1, i2;

        if (index) {
            i0 = index.getX(i * 3);
            i1 = index.getX(i * 3 + 1);
            i2 = index.getX(i * 3 + 2);
        } else {
            i0 = i * 3;
            i1 = i * 3 + 1;
            i2 = i * 3 + 2;
        }

        const v0x = position.getX(i0);
        const v0y = position.getY(i0);
        const v0z = position.getZ(i0);

        const v1x = position.getX(i1);
        const v1y = position.getY(i1);
        const v1z = position.getZ(i1);

        const v2x = position.getX(i2);
        const v2y = position.getY(i2);
        const v2z = position.getZ(i2);

        const crossX = v1y * v2z - v1z * v2y;
        const crossY = v1z * v2x - v1x * v2z;
        const crossZ = v1x * v2y - v1y * v2x;

        volume += (v0x * crossX + v0y * crossY + v0z * crossZ) / 6;
    }

    return Math.abs(volume);
}

/**
 * Verifica se uma mesh e fechada (watertight)
 * @param {THREE.BufferGeometry} geometry
 * @returns {boolean}
 */
export function isMeshWatertight(geometry) {
    if (!geometry) return false;

    const position = geometry.getAttribute('position');
    if (!position) return false;

    const index = geometry.getIndex();
    const edgeMap = new Map();

    const triCount = index ? index.count / 3 : position.count / 3;

    for (let i = 0; i < triCount; i++) {
        let indices;

        if (index) {
            indices = [
                index.getX(i * 3),
                index.getX(i * 3 + 1),
                index.getX(i * 3 + 2)
            ];
        } else {
            indices = [i * 3, i * 3 + 1, i * 3 + 2];
        }

        for (let j = 0; j < 3; j++) {
            const a = indices[j];
            const b = indices[(j + 1) % 3];
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
    }

    for (const count of edgeMap.values()) {
        if (count !== 2) return false;
    }

    return true;
}

/**
 * Conta triangulos
 * @param {THREE.BufferGeometry} geometry
 * @returns {number}
 */
export function countTriangles(geometry) {
    if (!geometry) return 0;
    const position = geometry.getAttribute('position');
    if (!position) return 0;
    const index = geometry.getIndex();
    return index ? index.count / 3 : position.count / 3;
}
