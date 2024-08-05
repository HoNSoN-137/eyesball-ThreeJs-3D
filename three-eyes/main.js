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
let imagePaths = [];
let imagePathData = [];


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
// 获取 #app 元素
const appContainer = document.getElementById('app');
// AmbientLight
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);
// Create renderer
const renderer = new THREE.WebGLRenderer();
// 这里是控制页面大小
renderer.setSize(window.innerWidth, window.innerHeight);

// Set camera position
camera.position.set(400, 400, 400);
camera.lookAt(0, 0, 0);
// Add axesHelper 坐标轴

// Orbit controls 控制鼠标对模型的缩放
appContainer.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);


/*
 * GLTF Loader
 */
const loader = new GLTFLoader();
function loadModelAndApplyTexture(path){
    //reset global variable
    tag =1;
    imagePaths = [];
    imagePathData = [];

    loader.load(
        "./main1.glb",
        (gltf) => {
            gltfScene = gltf.scene;
            scene.add(gltf.scene);
            changeimage(path,1);
        },
        undefined,
        (error) => {
            console.error('An error happened', error);
        }
    );
}
loadModelAndApplyTexture('left.jpg')


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


/**
 * 图像透明处理
 */
function Transparent(imagePath,effect) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imagePath, function(texture) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
        context.drawImage(texture.image, 0, 0);

        // 获取像素数据
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 处理像素数据，将黑色区域变为透明
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 10 && data[i + 1] < 10 && data[i + 2] < 10) {
                data[i + 3] = 0;
            }
        }

        // 将修改后的像素数据放回Canvas
        context.putImageData(imageData, 0, 0);
        const newImageUrl = canvas.toDataURL(); // 生成Base64数据URL
        changeimage(newImageUrl,effect);
    });
}


/* 
 * 上传图像的button
 */
function changeimage(imagePath, effect) {
    // 检查图像路径是否已存在
    const index = imagePaths.indexOf(imagePath);
    if (index !== -1) {
        // 如果存在，从imagePaths和imagePathData中删除
        imagePaths.splice(index, 1);
        imagePathData.splice(index, 1);
    } else {
        // 如果不存在，添加新的图像路径和effect
        imagePaths.push(imagePath);
        imagePathData.push({ path: imagePath, effect });
    }
    console.log("Current image paths:", imagePaths);
    console.log("Current image path data:", imagePathData);

    // 加载并应用所有图像路径中的纹理
    if (imagePaths.length === 0) {
        applyTexturesToMaterial([]);
    } else {
        const textureLoader = new THREE.TextureLoader();
        const textures = [];
        const effects = [];

        let texturesLoaded = 0;

        // 遍历imagePathData
        imagePathData.forEach((data, idx) => {
            textureLoader.load(data.path, function (texture) {
                textures[idx] = texture;
                effects[idx] = data.effect;
                texturesLoaded++;
                if (texturesLoaded === imagePathData.length) {
                    applyTexturesToMaterial(textures, effects);
                }
            });
        });
    }
}


function applyTexturesToMaterial(textures, effects) {
    gltfScene.traverse(function (child) {
        if (child.isMesh && child.material.name === "Material_inside") {
            child.material.transparent = true;
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
                    ${textures.map((_, i) => `color += texture2D(newTexture${i}, vUv) * float(${effects[i]});`).join('\n')}
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
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide
            });

            shaderMaterial.name = child.material.name;
            child.material = shaderMaterial;
            child.material.needsUpdate = true;
        }
    });
}


/*
 * 材质显示的 显示/消失 动画
 */
function fadeMaterial(material, duration) {
    new TWEEN.Tween(material)
        .to({ opacity:0 }, duration)
        .onUpdate(function() {
            material.transparent = true;
        })
        .onComplete(function() {
            material.visible = false; 
        })
        .start();
}



/* 
 * 材质显示的按钮
 */
function Visible(){ 
    gltfScene.traverse(function (child) {
        if (child.isMesh)
        {
            if(child.material.name === 'Material_Eyeball_front' ||
                // child.material.name === 'Material_outside_back' ||
                // child.material.name === 'Material_inside' ||
                child.material.name === 'Material_Sclera' ||
                // child.material.name === 'Material_Sclera_back' ||
                child.material.name === 'Material_Iris')
                {
                    if(child.material.name === 'Material_Sclera' )
                        child.visible = false; 
                    fadeMaterial(child.material, 1500); 
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
    animateCamera(new THREE.Vector3(0, 0, 500), 2000);
    Visible();
});

//叠加的图像
document.getElementById('HE').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
});
document.getElementById('MA').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
});
document.getElementById('SE').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
});
document.getElementById('EX').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
});
document.getElementById('ArteryButton').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
});
document.getElementById('VeinButton').addEventListener('click',  function() {
    Transparent('007-3412-200.jpg',1.5);
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