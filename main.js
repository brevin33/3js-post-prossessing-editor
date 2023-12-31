import * as THREE from 'three';
import { FBXLoader  } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GrassField } from './grass.js';
import { Stars } from './star.js';
import Stats from 'stats.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LuminosityShader } from 'three/addons/shaders/LuminosityShader.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { AfterimagePass  } from 'three/addons/postprocessing/AfterimagePass.js';
import { FilmPass  } from 'three/addons/postprocessing/FilmPass.js';
import { fireFly } from './firefly.js';


let renderer;
let grassField;
let cube;
let fireFlys;
let stats;
let scene;
let camera;
let d;
let dt;
let time;
let composer;
let postprocessingPasses;
const emptySpaceBelow = 1.0;
let x;
let y;
let plane;
let shaderMenuButton;
let shaderMenu;
let shaderMenuOut = false;
let desiredCamLookAt;
let currentCamLookAt;
let pageActive = true;
let shaderPassesDoc = document.querySelectorAll('.shaderPass');
let shadersDoc = document.querySelectorAll('.shader');
let shadersPipelinesDrops = document.querySelectorAll('.dropdown');
let PipelineDropdownHolder = document.querySelector('.dropdownContent');
let shaderPipelineDoc = document.getElementById('ShaderPipelineList');
let shadersConDoc = document.getElementById('Shaders');
let currentDraggingUnit = null;
let isClone = false;
let deadzone = document.getElementById('deadzone');
let isOverShaderPipeline = false;
const toggleButton = document.getElementById('toggleDropdown');
const dropdownContent = document.getElementById('dropdownContent');
const idToShaderName = [' ', ' ', ' ', ' ', ' ', ' ', 'Bloom', 'Gamma Correction', 'Cross Pattern', 'After Image', 'Film'];
let defaultShaderPass;
let defaultShaderPipeline = document.querySelector('.defaultShaderPipeline').cloneNode(true);
let pipelineNameInput = document.querySelector('.nameInputPipeline');
let shaderNameInput = document.getElementById("shaderNameInput");
let newShaderButton = document.getElementById("NewShaderButton");
let newShaderMenu = document.getElementById("shaderPopup");
let defaultPostProcessingShader = {

    name: 'Cross Shader',

    uniforms: {

        'tDiffuse': { value: null },
        'opacity': { value: 1.0 }

    },

    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`

        uniform float opacity;

        uniform sampler2D tDiffuse;

        varying vec2 vUv;
    
        float luminance(vec4 color){
            return (0.2126*color.x + 0.7152*color.y + 0.0722*color.z);
        }

        void main() {

            float crossPatern[30] = float[](0.95,0.95,1.0,0.95,0.95,
                                            0.95,0.95,0.95,1.0,0.95,
                                            0.95,0.95,0.95,0.95,1.0,
                                            1.0,0.95,0.95,0.95,0.95,
                                            0.95,1.0,0.95,0.95,0.95,
                                            0.95,0.95,1.0,0.95,0.95);
            float crossPatern2[30] = float[](1.0,0.80,1.0,0.80,1.0,
                                            0.80,1.0,0.80,1.0,0.80,
                                            0.80,0.80,1.0,0.80,1.0,
                                            1.0,0.80,0.80,1.0,0.80,
                                            0.80,1.0,0.80,0.80,1.0,
                                            1.0,0.80,1.0,0.80,0.80);
            vec4 texel = vec4(1.0 - vec3(texture2D( tDiffuse, vUv )),1.0);
            if(luminance(texel) > .9){
                gl_FragColor = vec4(1.0 -  vec3(opacity * texel * crossPatern[int(vUv.y * 1080.0)%6*5 + int(vUv.x * 1920.0)%5]),1.0);
            }else{
                gl_FragColor = vec4(1.0 -  vec3(opacity * texel * crossPatern2[int(vUv.y * 1080.0)%6*5 + int(vUv.x * 1920.0)%5]),1.0);
            }
        }`

};
let newShaderSaveButton = document.getElementById("newShaderSaveButton");
let shaderList = document.getElementById("ShaderList");
var editor = ace.edit("editor");
let baseShaderText = `uniform float opacity;
    
uniform sampler2D tDiffuse;
		
varying vec2 vUv;
		
void main() {
		
	vec4 texel = texture2D( tDiffuse, vUv );
	gl_FragColor = opacity * texel;
		
}`
let savedPipelines = []
let savedPipelinesNames = []

init();

animate();

function animate( ) {
	requestAnimationFrame( animate );
    if(pageActive == false){return}
    d = new Date();
    dt = d.getTime() - time; 
    time = d.getTime();
	cube.rotation.x += .0002 * dt;
	cube.rotation.y += .0002 * dt;
    if( grassField ){
        grassField.update( dt )
    }

    for(let i = 0; i < fireFlys.length; i++){
        fireFlys[i].update(dt);
    }

    currentCamLookAt.x = moveTowards(currentCamLookAt.x, desiredCamLookAt.x, .015*dt);
    currentCamLookAt.y = moveTowards(currentCamLookAt.y, desiredCamLookAt.y, .015*dt);
    camera.lookAt(currentCamLookAt);
    stats.update();
	composer.render( );
    renderer.info.reset();
}

function init(){
    if(localStorage.getItem('savedPipelines')){
        savedPipelines = localStorage.getItem('savedPipelines');
        savedPipelines = JSON.parse(savedPipelines);
        savedPipelinesNames = localStorage.getItem('savedPipelinesNames')
        savedPipelinesNames = JSON.parse(savedPipelinesNames);
    }
    for(let i = 0; i < savedPipelines.length; i++){
        let newShaderPipeline = defaultShaderPipeline.cloneNode(true);
        newShaderPipeline.addEventListener('click', selectPipeline);
        let deleteButton = newShaderPipeline.getElementsByTagName('button')[0];
        deleteButton.addEventListener('click', deleteItem2);
        deleteButton.style.scale = 1;
        let shaderPasses = savedPipelines[i];
        newShaderPipeline.id = JSON.stringify(shaderPasses);
        newShaderPipeline.getElementsByTagName('span')[1].innerHTML = savedPipelinesNames[i];
        PipelineDropdownHolder.appendChild(newShaderPipeline);    
    }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / (window.innerHeight * emptySpaceBelow), 0.1, 1000 );
    camera.lookAt(new THREE.Vector3(0,0,-1));
    currentCamLookAt = new THREE.Vector3(0,0,-1);
    desiredCamLookAt = new THREE.Vector3(0,0,-1);
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#bg'),
        antialias: true,
    });
    renderer.setSize( window.innerWidth, window.innerHeight * emptySpaceBelow);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1));
    renderer.shadowMap.enabled = false;
    renderer.toneMappingExposure = .1;
    renderer.info.autoReset = false; 
    stats = createStats();

    const directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.position.set(.1,1,-.2);
    scene.add( directionalLight );

    // cube and plane
    const geometry = new THREE.PlaneGeometry( 200, 200 );
    const planeMaterial = new THREE.MeshBasicMaterial( { color: 0x092016 } );
    const material = new THREE.MeshStandardMaterial( { color: 0x006a7d } );
    const cubeMaterial = new THREE.MeshStandardMaterial( { color: 0x006a7d } );
    const unlitMaterial = new THREE.MeshStandardMaterial( { emissive : 0xfef6ab , emissiveIntensity: 3} );
    plane = new THREE.Mesh( geometry, planeMaterial );
    plane.rotation.x = - Math.PI / 2;
    plane.position.set(0,0-2.6,-22)
    plane.scale.set(.5,.5,.5);
    scene.add( plane );

    const box = new THREE.BoxGeometry( 1, 1, 1 );
    cube = new THREE.Mesh( box, cubeMaterial );
    cube.scale.set(5.5,5.5,5.5);
    cube.position.set(0,4,-13);
    scene.add( cube );

    // grass
    grassField = new GrassField();
    scene.add(grassField);

    // stars
    const stars = new Stars();
    scene.add(stars);

    // fireflys
    fireFlys = [];
    const body = new THREE.Mesh( box, unlitMaterial );
    const fireFlySize = .15;
    body.scale.set(fireFlySize,fireFlySize,fireFlySize);
    const x = 0;
    const z = -2;
    const y = .4;
    body.position.set(x - .8, y, z);
    scene.add(body);
    const pointLight = new THREE.PointLight(0xfefaad, 2, 10, .3);
    pointLight.position.set(x, y, z);
    scene.add( pointLight );
    const body2 = new THREE.Mesh( box, unlitMaterial );
    body2.scale.set(fireFlySize,fireFlySize,fireFlySize);
    body2.position.set(x + .8, y, z);
    scene.add(body2);
    const pointLight2 = new THREE.PointLight(0xfefaad, 2, 10, .3);
    pointLight.position.set(x, y, z);
    scene.add( pointLight2 );
    fireFlys.push(new fireFly(body2, pointLight2));
    fireFlys.push(new fireFly(body, pointLight));
    for(let i = 0; i < 25; i++){
        const body = new THREE.Mesh( box, unlitMaterial );
        const fireFlySize = .15;
        body.scale.set(fireFlySize,fireFlySize,fireFlySize);
        const x = Math.random() * 70 - 35;
        const z = Math.random() * 44 - 40;
        body.position.set(x, y, z);
        scene.add(body);
        const pointLight = new THREE.PointLight(0xfefaad, 2, 10, .3);
        pointLight.position.set(x, y, z);
        scene.add( pointLight );
        fireFlys.push(new fireFly(body, pointLight));
    }

    const ambientLight = new THREE.AmbientLight( 0xffffff, .2 );
    scene.add( ambientLight );

    // pillars
    const loader = new FBXLoader();

    loader.load( './pillar.fbx', function ( object ) {
        const loadedMesh = new THREE.Mesh( object.children[0].geometry, material );
        const loadedMesh2 = new THREE.Mesh( object.children[0].geometry, material );
        const loadedMesh3 = new THREE.Mesh( object.children[0].geometry, material );
        const loadedMesh4 = new THREE.Mesh( object.children[0].geometry, material );
        let height = 3.3;
        let width = 1;
        loadedMesh.scale.set(width,width,height);
        loadedMesh2.scale.set(width,width,height);
        loadedMesh3.scale.set(width,width,height);
        loadedMesh4.scale.set(width,width,height);
        loadedMesh.rotateOnAxis(new THREE.Vector3(1,0,0), 1.571);
        loadedMesh2.rotateOnAxis(new THREE.Vector3(1,0,0), 1.571);
        loadedMesh3.rotateOnAxis(new THREE.Vector3(1,0,0), 1.571);
        loadedMesh4.rotateOnAxis(new THREE.Vector3(1,0,0), 1.571);
        loadedMesh.position.set(10,1.6,-17);
        scene.add( loadedMesh );
        loadedMesh2.position.set(-10,1.6,-17);
        scene.add( loadedMesh2 );
        loadedMesh3.position.set(10,1.6,-4.5);
        scene.add( loadedMesh3 );
        loadedMesh4.position.set(-10,1.6,-4.5);
        scene.add( loadedMesh4 );
    }, undefined, function ( error ) {
        console.error( error );
    } );

    camera.position.z = 5;
    camera.position.y = .2;

    //const controls = new OrbitControls(camera, renderer.domElement)

    d = new Date();
    time = d.getTime(); 



    // events
    shaderMenuButton = document.getElementById('shaderMenuButton');
    shaderMenuButton.addEventListener("click", shaderMenuButtonClicked)
    shaderMenu = document.getElementById('shaderMenu');
    renderer.domElement.onmousemove = moveCamera;
    document.addEventListener("visibilitychange", (event) => {
        if (document.visibilityState == "visible") {
            pageActive = true;
        } else {
            pageActive = false;
        }
      });
    window.addEventListener( 'resize', onWindowResize );

    shaderPipelineDoc.addEventListener('dragover', dragOverPipline);
    shaderPipelineDoc.addEventListener('dragleave', dragLeavePipline);


    shaderPassesDoc.forEach(shaderPassDoc => {
        shaderPassDoc.addEventListener('dragstart', dragStartShaderPass);
        shaderPassDoc.addEventListener('dragend', dragEndShaderPass);
        shaderPassDoc.getElementsByTagName('button')[0].addEventListener('click', deleteItem);
    });
    shadersDoc.forEach(shaderDoc => {
        shaderDoc.addEventListener('dragstart', dragStartShader);
        shaderDoc.addEventListener('dragend', dragEndShader);
        shaderDoc.getElementsByTagName('button')[0].addEventListener('click', deleteItem);
    });

    toggleButton.addEventListener('click', () => {
        dropdownContent.classList.toggle('hidden');
      });
  
    document.addEventListener('click', (event) => {
      if (!toggleButton.contains(event.target) && !dropdownContent.contains(event.target)) {
        dropdownContent.classList.add('hidden');
        dropdownContent.getElementsByTagName('button')[0].addEventListener('click', deleteItem2);
      }
    });

    newShaderSaveButton.addEventListener('click', saveNewShaderButtonClicked);

    shadersPipelinesDrops.forEach(shadersPipelinesDrop => {shadersPipelinesDrop.addEventListener('click', selectPipeline)});

    newShaderButton.addEventListener('click', newShaderButtonPressed);

    document.getElementById('Save').addEventListener('click', saveShaderPass);

    shaderPassesDoc = [...shaderPassesDoc];

    defaultShaderPass = shaderPassesDoc[0].cloneNode(true);

    // post
    postprocessingPasses = []
    postprocessingPasses.push(new RenderPass( scene, camera ));
    postprocessingPasses.push(new OutputPass());
    postprocessingPasses.push(new ShaderPass( LuminosityShader ));
    postprocessingPasses.push(new ShaderPass( DotScreenShader ));
    postprocessingPasses.push(new ShaderPass( RGBShiftShader ));
    postprocessingPasses.push(new BokehPass( scene, camera, {focus: 0.0,  aspect : camera.aspect, maxblur: .0015, aperture: 0.05 } ));
    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight * emptySpaceBelow ), 0.35, 0.5, 0.85 );
    postprocessingPasses.push(bloomPass);
    postprocessingPasses.push(new ShaderPass(GammaCorrectionShader));  
    postprocessingPasses.push(new ShaderPass({

        name: 'Cross Shader',
    
        uniforms: {
    
            'tDiffuse': { value: null },
            'opacity': { value: 1.0 }
    
        },
    
        vertexShader: /* glsl */`
    
            varying vec2 vUv;
    
            void main() {
    
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    
            }`,
    
        fragmentShader: /* glsl */`
    
            uniform float opacity;
    
            uniform sampler2D tDiffuse;
    
            varying vec2 vUv;
        
            float luminance(vec4 color){
                return (0.2126*color.x + 0.7152*color.y + 0.0722*color.z);
            }

            void main() {

                float crossPatern[30] = float[](0.95,0.95,1.0,0.95,0.95,
                                                0.95,0.95,0.95,1.0,0.95,
                                                0.95,0.95,0.95,0.95,1.0,
                                                1.0,0.95,0.95,0.95,0.95,
                                                0.95,1.0,0.95,0.95,0.95,
                                                0.95,0.95,1.0,0.95,0.95);
                float crossPatern2[30] = float[](1.0,0.80,1.0,0.80,1.0,
                                                0.80,1.0,0.80,1.0,0.80,
                                                0.80,0.80,1.0,0.80,1.0,
                                                1.0,0.80,0.80,1.0,0.80,
                                                0.80,1.0,0.80,0.80,1.0,
                                                1.0,0.80,1.0,0.80,0.80);
                vec4 texel = vec4(1.0 - vec3(texture2D( tDiffuse, vUv )),1.0);
                if(luminance(texel) > .9){
                    gl_FragColor = vec4(1.0 -  vec3(opacity * texel * crossPatern[int(vUv.y * 1080.0)%6*5 + int(vUv.x * 1920.0)%5]),1.0);
                }else{
                    gl_FragColor = vec4(1.0 -  vec3(opacity * texel * crossPatern2[int(vUv.y * 1080.0)%6*5 + int(vUv.x * 1920.0)%5]),1.0);
                }
            }`
    
    }))
    postprocessingPasses.push(new AfterimagePass())
    postprocessingPasses.push(new FilmPass())
    
    // ect
    setupComposer();
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/glsl");


}

function setupComposer(){
    composer = new EffectComposer( renderer );
    composer.addPass(postprocessingPasses[0]);
    for(let i = 0; i < shaderPassesDoc.length; i++){
        composer.addPass(postprocessingPasses[parseInt(shaderPassesDoc[i].id)]);
    }
    composer.addPass(postprocessingPasses[1]);
    console.log(composer);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / (window.innerHeight * emptySpaceBelow);
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight * emptySpaceBelow );
    composer.setSize( window.innerWidth, window.innerHeight * emptySpaceBelow );
}

function moveCamera(e){
    x = (e.offsetX/window.innerWidth - 0.5) * 7.0;
    y = (e.offsetY/(window.innerHeight * emptySpaceBelow) - 0.82) * 5.5;
    desiredCamLookAt = new THREE.Vector3(x,-y,-1);
}

function newShaderButtonPressed(){
    shaderMenuButtonClicked();
    newShaderMenu.classList.remove("hidden");
}

function deleteItem(){
    this.parentElement.remove();
    shaderPassesDoc = [...document.querySelectorAll('.shaderPass')];
    setupComposer();
}

function deleteItem2(event){
    event.stopPropagation();
    const name = this.parentElement.getElementsByTagName('span')[0].innerHTML;
    const index = savedPipelinesNames.findIndex((n) => n == name);
    savedPipelinesNames.splice(index,1);
    savedPipelines.splice(index,1);
    localStorage.setItem('savedPipelines',JSON.stringify(savedPipelines));
    localStorage.setItem('savedPipelinesNames',JSON.stringify(savedPipelinesNames));
    this.parentElement.parentElement.remove();
}

function saveShaderPass(){
    let newShaderPipeline = defaultShaderPipeline.cloneNode(true);
    newShaderPipeline.addEventListener('click', selectPipeline);
    let deleteButton = newShaderPipeline.getElementsByTagName('button')[0];
    deleteButton.addEventListener('click', deleteItem2);
    deleteButton.style.scale = 1;
    let shaderPasses = []
    for(let i = 0; i < shaderPassesDoc.length; i++){
        shaderPasses.push(shaderPassesDoc[i].id);
    }
    newShaderPipeline.id = JSON.stringify(shaderPasses);
    newShaderPipeline.getElementsByTagName('span')[1].innerHTML = pipelineNameInput.value;
    savedPipelines.push(shaderPasses);
    savedPipelinesNames.push(pipelineNameInput.value);
    localStorage.setItem('savedPipelines',JSON.stringify(savedPipelines));
    localStorage.setItem('savedPipelinesNames',JSON.stringify(savedPipelinesNames));
    PipelineDropdownHolder.appendChild(newShaderPipeline);
}

function getDragAfterElement(container, y){
    return shaderPassesDoc.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if(offset < 0 && offset > closest.offset){
            return {offset: offset, element: child};
        }else{
            return closest;
        }
    }, {offset: Number.NEGATIVE_INFINITY}).element;
}

function dragOverPipline(e){
    e.preventDefault();
    let afterElement = getDragAfterElement(this, e.clientY);
    if(afterElement == null){
        this.appendChild(currentDraggingUnit);
    }else{
        this.insertBefore(currentDraggingUnit, afterElement);
    }
    isOverShaderPipeline = true;
}

function dragLeavePipline(){
    isOverShaderPipeline = false;
}

function dragStartShader(){
    this.classList.add('dragging');
    currentDraggingUnit = this.cloneNode(true);
    currentDraggingUnit.addEventListener('dragstart', dragStartShaderPass);
    currentDraggingUnit.addEventListener('dragend', dragEndShaderPass);
    currentDraggingUnit.getElementsByTagName('button')[0].addEventListener('click', deleteItem);
    currentDraggingUnit.getElementsByTagName('button')[0].style.scale = '100%';
    isClone = true;
}

function dragStartShaderPass(){
    this.classList.add('dragging');
    currentDraggingUnit = this;
    isClone = false;
}

function dragEndShader(){
    this.classList.remove('dragging');
    if(!isOverShaderPipeline){
        currentDraggingUnit.remove();
    }else{
        currentDraggingUnit.classList.remove('dragging');
        currentDraggingUnit.classList.add('shaderPass');
        shaderPassesDoc = [...document.querySelectorAll('.shaderPass')];
        currentDraggingUnit = null;
        setupComposer();
    }
}

function dragEndShaderPass(){
    this.classList.remove('dragging');
    currentDraggingUnit = null;
    shaderPassesDoc = [...document.querySelectorAll('.shaderPass')];
    setupComposer();
}

function createStats() {
    var stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0';
    stats.domElement.style.top = '0';
    document.body.appendChild(stats.dom)
    return stats;
}

function shaderMenuButtonClicked(){
    if(shaderMenuOut){
        shaderMenu.style.left = '100%';
        shaderMenuButton.style.left = '95%';
        shaderMenuOut = false;
    }
    else{
        shaderMenu.style.left = '80%';
        shaderMenuButton.style.left = '75%';
        shaderMenuOut = true;
    }
}

function moveTowards(num1, num2, maxSpeed){
    if(num1 > num2){return Math.max( num1 - maxSpeed, num2);}
    else{return Math.min( num1 + maxSpeed, num2);}
}

function saveNewShaderButtonClicked(){
    let newShader = JSON.parse(JSON.stringify(defaultPostProcessingShader));
    newShader.fragmentShader = editor.getValue();
    let shaderId = postprocessingPasses.length;
    postprocessingPasses.push(new ShaderPass( newShader ));
    let newPass = defaultShaderPass.cloneNode(true); 
    newPass.id = shaderId;
    newPass.getElementsByTagName('p')[0].innerHTML  = idToShaderName[shaderId];
    newPass.addEventListener('dragstart', dragStartShader);
    newPass.addEventListener('dragend', dragEndShader);
    newPass.getElementsByTagName('button')[0].addEventListener('click', deleteItem);
    newPass.classList.remove('shaderPass');
    newPass.getElementsByTagName('p')[0].innerHTML = shaderNameInput.value;
    shaderList.appendChild(newPass);
    
    newShaderMenu.classList.add("hidden");
}

function selectPipeline(){
    const shaderIds = JSON.parse(this.id);
    shaderPipelineDoc.innerHTML = '';
    for(let i = 0; i < shaderIds.length;  i++){
        let shaderId = shaderIds[i];
        let newPass = defaultShaderPass.cloneNode(true); 
        newPass.id = shaderId;
        newPass.getElementsByTagName('p')[0].innerHTML  = idToShaderName[shaderId];
        newPass.addEventListener('dragstart', dragStartShaderPass);
        newPass.addEventListener('dragend', dragEndShaderPass);
        newPass.getElementsByTagName('button')[0].addEventListener('click', deleteItem);
        shaderPipelineDoc.appendChild(newPass);
    }
    shaderPassesDoc = [...document.querySelectorAll('.shaderPass')];
    setupComposer();
}