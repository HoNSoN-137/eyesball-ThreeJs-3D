import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

/*
 * 定义
 */
let img = 'left.jpg'; //底圖眼背影像path
let gltfScene;

/*
 * 基础场景搭建
 */
// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
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
loader.load(
    "./main1.glb",
    (gltf) => {
        gltfScene = gltf.scene;
        scene.add(gltf.scene);

        // 加载眼球影像
        const imageSource = 'left.jpg'; //dault left eyes
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(imageSource, (texture) => {
            gltfScene.traverse((child) => {
                if (child.isMesh && child.material.name === "Material_back") {
                    // 直接设置纹理
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                }
            });
            window.dispatchEvent(new Event('load'));
        }, undefined, function (error) {
            console.error('Error loading texture:', error);
        });
        // 保留原始材质，在插入图像时保留最初的图像纹理
        // gltf.scene.traverse(function (child) {
        //     if (child.isMesh) {
        //         //child.geometry.computeVertexNormals(); // 重新计算法线
        //         if (child.material.map) {
        //             child.material.emissive = child.material.color;
        //             child.material.emissiveMap = child.material.map;
        //         }
        //     }
        // });
    },
    undefined,
    (error) => {
        console.error('An error happened', error);
    }
);


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
    loader.load(
        "./main1.glb",
        (gltf) => {
            gltfScene = gltf.scene;
            scene.add(gltf.scene);
            const imageSource = path;
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(imageSource, (texture) => {
                gltfScene.traverse((child) => {
                    if (child.isMesh && child.material.name === "Material_back") {
                        // 直接设置纹理
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    }
                });
            });
        }
    );
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
    // 动画开始时间 // 相机初始位置
    const startTime = Date.now(); 
    const startPosition = camera.position.clone();

    function updateCamera() {
        // 已经过去的时间 // 完成的百分比
        const elapsedTime = Date.now() - startTime; 
        const fraction = elapsedTime / duration; 

        if (fraction < 1) {
            // 计算当前位置
            camera.position.z = startPosition.z + (targetPosition.z - startPosition.z) * fraction;
            camera.position.x = startPosition.x + (targetPosition.x - startPosition.x) * fraction;
            camera.position.y = startPosition.y + (targetPosition.y - startPosition.y) * fraction;
            // 继续动画 // 重新渲染场景
            requestAnimationFrame(updateCamera); 
            renderer.render(scene, camera); 
        } else {
            // 确保相机最终位置正确
            camera.position.copy(targetPosition);
            renderer.render(scene, camera);
        }
    }
    updateCamera();
}


/* 
 * 上传图像的button
 */
let currentOldTexture = null;

function changeimage(imagePath) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imagePath, function (newTexture) {
        // Optional: corrects color space if needed
        // newTexture.encoding = THREE.sRGBEncoding;

        gltfScene.traverse(function (child) {
            if (child.isMesh && child.material.name === "Material_back") {
                if (!currentOldTexture) {
                    currentOldTexture = child.material.map;
                }
                const oldTexture = currentOldTexture;

                const vertexShader = `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `;

                const fragmentShader = `
                    uniform sampler2D oldTexture;
                    uniform sampler2D newTexture;
                    varying vec2 vUv;
                    void main() {
                        vec4 oldColor = texture2D(oldTexture, vUv);
                        vec4 newColor = texture2D(newTexture, vUv);
                        // 下面两行是控制半透明强度
                        // oldColor.a = 0.9;
                        // newColor.a = 0.9;
                        gl_FragColor = oldColor + newColor * 0.85; // 调节新旧图像比例
                    }
                `;

                const uniforms = {
                    oldTexture: { value: oldTexture },
                    newTexture: { value: newTexture }
                };

                const shaderMaterial = new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    /* 下面两行是控制半透明效果 */
                    // transparent: true,
                    // blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide // 确保材质双面可见
                });

                child.material = shaderMaterial;
                child.material.needsUpdate = true;

                // 更新 currentOldTexture 为新的 newTexture
                currentOldTexture = newTexture;
            }
        });
    });
};



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
 * 材质显示的按钮
 */ 
function Visible(a){  //a 區分in和ToggleButton 
   gltfScene.traverse(function (child) {
        if (child.isMesh)
        {
            if(child.material.name === 'Material_1' || 
                child.material.name === 'Material_Sclera' ||  
                child.material.name === 'Material_Iris')
                if(a === 'in')
                    child.visible = false; 
                else
                    child.visible = !child.visible; 
        }
             
    }); 
}



/*
 * 所有Button 
 */
// 左眼球图像按钮
document.getElementById('LButton').addEventListener('click', function(event) {
  loadModelAndTexture('left.jpg');
});
// 右眼球图像按钮
document.getElementById('RButton').addEventListener('click', function(event) {
  loadModelAndTexture('right.jpg');
});
document.getElementById('inButton').addEventListener('click', function() {
    animateCamera(new THREE.Vector3(400, 200, 550), 2000);
    Visible('in');
});
document.getElementById('ToggleButton').addEventListener('click',  function() {
    Visible(1);
});
document.getElementById('image1').addEventListener('click',  function() {
    changeimage('left.jpg');
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
  }
  
  render();