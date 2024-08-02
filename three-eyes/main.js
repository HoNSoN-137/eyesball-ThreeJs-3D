import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
//import * as TWEEN from 'three/examples/jsm/loaders/tween.umd.js'
// import { convertTiffToJpg } from './convert.js';


/*
 * 定义
 */
let gltfScene;
let tag = 1;
let imagePaths = [];


/*
 * 基础场景搭建
 */
// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
// Create camera
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// AmbientLight
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);
// Create renderer
const renderer = new THREE.WebGLRenderer();
// 这里是控制页面大小
renderer.setSize(window.innerWidth, window.innerHeight);
//renderer.setSize(window.innerWidth/2, window.innerHeight/2);
document.body.appendChild(renderer.domElement);
// Set camera position
camera.position.set(400, 400, 400);
camera.lookAt(0, 0, 0);
// Add axesHelper 坐标轴
// const axesHelper = new THREE.AxesHelper(300);
// scene.add(axesHelper);
// Orbit controls 控制鼠标对模型的缩放
const controls = new OrbitControls(camera, renderer.domElement);


/*
 * GLTF Loader
 */
const loader = new GLTFLoader();
function loadModelAndApplyTexture(path){
    //reset global variable
    tag =1;
    imagePaths = [];

    loader.load(
        "./main1.glb",
        (gltf) => {
            gltfScene = gltf.scene;
            scene.add(gltf.scene);

            // 加载眼球影像
            const imageSource = path; //dault left eyes
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(imageSource, (texture) => {
                gltfScene.traverse((child) => {
                    if (child.isMesh && child.material.name === "Material_inside") {
                        // 直接设置纹理
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    }
                });
                window.dispatchEvent(new Event('load'));
            }, undefined, function (error) {
                console.error('Error loading texture:', error);
            });

        },
        undefined,
        (error) => {
            console.error('An error happened', error);
        }
    );
}
loadModelAndApplyTexture('left.jpg')


/*
 * 重加载眼球影像
 */
function loadModelAndTexture(path){
    if (gltfScene !== null) {
        scene.remove(gltfScene);
        // 释放资源
        gltfScene.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}


/*
 * HDR Loader加载场景
 */
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  './hospital_room_8k.hdr',
  (texture) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();
    render(); 
  },
  undefined,
  (error) => {
    console.error('Error loading HDR texture', error);
  }
);


/*
 * Animate function 渲染
 */
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();


/*
 * Listen for window resize
 */
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});


/* 
 * 更新相机位置（从眼球的外面进入到眼球内部）
 */
function animateCamera(targetPosition, duration) {
    const startPosition = camera.position.clone();

    const tween = new TWEEN.Tween(startPosition)
        .to({ x: targetPosition.x, y: targetPosition.y, z: targetPosition.z }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut) // Use an easing function for smooth animation
        .onUpdate(function() {
            camera.position.set(startPosition.x, startPosition.y, startPosition.z);
            renderer.render(scene, camera);
        })
        .onComplete(function() {
            camera.position.copy(targetPosition);
            renderer.render(scene, camera);
        })
        .start();
}


/* 
 * 上传图像的button (new)
 */
function changeimage(imagePath) {
    let index = imagePaths.indexOf(imagePath);
    if (index !== -1) {
        imagePaths.splice(index, 1);
    } else {
        imagePaths.push(imagePath);
    }
    //console.log("Current image paths:", imagePaths);

    // 加载并应用所有图像路径中的纹理
    if (imagePaths.length === 0) {
        applyTexturesToMaterial([]);
    } else {
        const textureLoader = new THREE.TextureLoader();
        const textures = [];

        let texturesLoaded = 0;

        // 遍历imagePaths
        imagePaths.forEach((path, idx) => {
            textureLoader.load(path, function (texture) {
                textures[idx] = texture;
                texturesLoaded++;
                if (texturesLoaded === imagePaths.length) {
                    applyTexturesToMaterial(textures);
                }
            });
        });
    }
}


function applyTexturesToMaterial(textures) {
    gltfScene.traverse(function (child) {
        if (child.isMesh && child.material.name === "Material_inside") {
            // 检查并存储旧纹理
            if (!child.userData.oldTexture) {
                child.userData.oldTexture = child.material.map;
            }
            const oldTexture = child.userData.oldTexture;

            const vertexShader = `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;

            const fragmentShader = `
                uniform sampler2D oldTexture;
                varying vec2 vUv;
                ${textures.map((_, i) => `uniform sampler2D newTexture${i};`).join('\n')}
                void main() {
                    vec4 color = texture2D(oldTexture, vUv);
                    ${textures.map((_, i) => `color += texture2D(newTexture${i}, vUv) * 0.85 / ${textures.length.toFixed(1)};`).join('\n')}
                    gl_FragColor = color;
                }
            `;

            const uniforms = {
                oldTexture: { value: oldTexture },
                ...textures.reduce((acc, texture, i) => {
                    acc[`newTexture${i}`] = { value: texture };
                    return acc;
                }, {})
            };

            const shaderMaterial = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                // transparent: true, // 可选：启用半透明效果
                // blending: THREE.AdditiveBlending, // 可选：设置混合模式
                side: THREE.DoubleSide // 确保材质双面可见
            });

            shaderMaterial.name = child.material.name;
            child.material = shaderMaterial;
            child.material.needsUpdate = true;
        }
    });
}



/* 
 * 创建并样式化滑动条，用于调节环境光亮度（要是网页大小要调整，这里要改为动态调整滑动条位置）
 */ 
// const slider = document.createElement('input');
// slider.type = 'range';
// slider.min = 0;
// slider.max = 10;
// slider.value = ambientLight.intensity;
// slider.step = 0.1;
// slider.style.position = 'absolute';
// slider.style.top = '10px';
// slider.style.right = '10px';
// slider.style.zIndex = 100;
// document.body.appendChild(slider);
// // 调节环境光亮度
// slider.addEventListener('input', function (event) {
//     ambientLight.intensity = event.target.value;
// });


/*
 * 材质显示的 显示/消失 动画
 */
function fadeMaterial(material, duration, visible) {
    new TWEEN.Tween(material)
        .to({ opacity: visible? 1:0 }, duration)
        .onUpdate(function() {
            material.transparent = !visible;
        })
        .onComplete(function() {
            material.visible = visible; // Hide the mesh after fade out
        })
        .start();
}
function fadeInMaterial(material, duration) {
    material.visible = true; // Ensure the mesh is visible before fade in
    new TWEEN.Tween(material)
        .to({ opacity: 1 }, duration)
        .onUpdate(function() {
            material.transparent = 0;
        })
        .start();
}


/* 
 * 材质显示的按钮
 */
function Visible(a){  //a 區分in和ToggleButton 
    if(a === 'in')
        tag = 0;
    else 
        tag = !tag;

    gltfScene.traverse(function (child) {
        if (child.isMesh)
        {
            if(child.material.name === 'Material_Eyeball_front' ||
                // child.material.name === 'Material_outside_back' ||
                // child.material.name === 'Material_inside' ||
                child.material.name === 'Material_Sclera' ||
                // child.material.name === 'Material_Sclera_back' ||
                child.material.name === 'Material_Iris')
                if(a === 'in')
                {
                    if(child.material.name === 'Material_Sclera' )
                        child.visible = false; 
                    fadeMaterial(child.material, 1500,0); 
                }
                else if(a === 'ToggleButton' && tag )
                {
                    if(child.material.name === 'Material_Sclera' )
                        child.visible = true; 
                    fadeInMaterial(child.material, 1000); 
                    
                } else 
                {
                    if(child.material.name === 'Material_Sclera' )
                        child.visible = false; 
                    fadeMaterial(child.material, 1500,0); 
                }
        }
    }); 
}



/*
 * 所有Button 
 */
// 左眼球图像按钮
document.getElementById('LButton').addEventListener('click', function(event) {
    loadModelAndApplyTexture('left.jpg');
    camera.position.set(-400, 400, 400);
});
// 右眼球图像按钮
document.getElementById('RButton').addEventListener('click', function(event) {
    loadModelAndApplyTexture('right.jpg');
    camera.position.set(400, 400, 400);
});
//镜头放大
document.getElementById('inButton').addEventListener('click', function() {
    animateCamera(new THREE.Vector3(0, 0, 550), 2000);
    Visible('in');
});
//切换眼底图像
document.getElementById('ToggleButton').addEventListener('click',  function() {
    Visible('ToggleButton');
});
//叠加的图像
document.getElementById('image1').addEventListener('click',  function() {
    changeimage('eyebase.jpg');
});
document.getElementById('image2').addEventListener('click',  function() {
    changeimage('right.jpg');
});


/*
 * Helper function to render the scene 这里是把场景应用上
 */
function render() {
    renderer.render(scene, camera);
    controls.update();
    requestAnimationFrame(render);
    TWEEN.update();
}
  
  
  render();