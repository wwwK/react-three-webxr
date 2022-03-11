import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { VRBTN } from "./VRBTN";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

class Archi {
  constructor(app) {
    const container = document.createElement("div");
    app.appendChild(container);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      500
    );
    this.camera.position.set(0, 1.6, 0);

    this.dolly = new THREE.Object3D();
    this.dolly.position.set(0, 0, 10);
    this.dolly.add(this.camera);
    this.dummyCam = new THREE.Object3D();
    this.camera.add(this.dummyCam);

    this.scene = new THREE.Scene();
    this.scene.add(this.dolly);

    const ambient = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.8);
    this.scene.add(ambient);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(this.renderer.domElement);

    window.addEventListener("resize", this.resize.bind(this));

    this.clock = new THREE.Clock();
    this.up = new THREE.Vector3(0, 1, 0);
    this.origin = new THREE.Vector3();
    this.workingVec3 = new THREE.Vector3();
    this.workingQuaternion = new THREE.Quaternion();
    this.raycaster = new THREE.Raycaster();

    this.loadCollege();
    this.initScene();

    this.immersive = false;


  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  
  initScene() {
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 50, 100);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(200, 200),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    var grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    const geometry = new THREE.BoxGeometry(5, 5, 5);
    const material = new THREE.MeshPhongMaterial({ color: "#008B8B" });
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );

    this.colliders = [];

  }

  loadCollege() {
    const dracoLoader = new DRACOLoader();
    // dracoLoader.setDecoderPath(
    //   "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/js/libs/draco/"
    // ); // use a full url path

    const loader = new FBXLoader().setPath("./");
    // loader.setDRACOLoader(dracoLoader);

    const self = this;

    // Load a glTF resource
    loader.load(
      // resource URL
      "table.FBX",
      // called when the resource is loaded
      function (gltf) {
        // const college = gltf.scene.children[0];

        gltf.scale.set(0.02,0.02,0.02)
        self.scene.add(gltf);

        gltf.traverse(function (child) {
          if (child.isMesh) {
            if (child.name.indexOf("PROXY") != -1) {
              child.material.visible = false;
              self.proxy = child;
            } 
            else if (child.material.name.indexOf("Glass") != -1) {
              child.material.opacity = 0.1;
              child.material.transparent = true;
            } 
            else if (child.material.name.indexOf("SkyBox") != -1) {
              const mat1 = child.material;
              const mat2 = new THREE.MeshBasicMaterial({ map: mat1.map });
              child.material = mat2;
              mat1.dispose();
            }
          }
        });



        self.setupXR();
      },
      // called while loading is progressing
      function (xhr) {
        console.log(xhr.loaded / xhr.total * 100 + "% loaded");
      },
      // called when loading has errors
      function (error) {
        console.log("An error happened");
      }
    );
  }

  setupXR() {
    this.renderer.xr.enabled = true;

    const btn = new VRBTN(this.renderer);

    const self = this;

    function onSelectStart(event) {
      this.userData.selectPressed = true;
    }

    function onSelectEnd(event) {
      this.userData.selectPressed = false;
    }

    this.controllers = this.buildControllers(this.dolly);

    this.controllers.forEach((controller) => {
      controller.addEventListener("selectstart", onSelectStart);
      controller.addEventListener("selectend", onSelectEnd);
    });

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  buildControllers(parent = this.scene) {
    const controllerModelFactory = new XRControllerModelFactory();

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);

    const line = new THREE.Line(geometry);
    line.scale.z = 0;

    const controllers = [];

    for (let i = 0; i <= 1; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.add(line.clone());
      controller.userData.selectPressed = false;
      parent.add(controller);
      controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      parent.add(grip);
    }

    return controllers;
  }

  moveDolly(dt) {
    if (this.proxy === undefined) return;

    const wallLimit = 1.3;
    const speed = 2;
    let pos = this.dolly.position.clone();
    pos.y += 1;

    let dir = new THREE.Vector3();
    //Store original dolly rotation
    const quaternion = this.dolly.quaternion.clone();
    //Get rotation for movement from the headset pose
    this.dolly.quaternion.copy(
      this.dummyCam.getWorldQuaternion(this.workingQuaternion)
    );
    this.dolly.getWorldDirection(dir);
    dir.negate();
    this.raycaster.set(pos, dir);

    let blocked = false;

    let intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit) blocked = true;
    }

    if (!blocked) {
      this.dolly.translateZ(-dt * speed);
      pos = this.dolly.getWorldPosition(this.origin);
    }

    //cast left
    dir.set(-1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.raycaster.set(pos, dir);

    intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(wallLimit - intersect[0].distance);
    }

    //cast right
    dir.set(1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.raycaster.set(pos, dir);

    intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(intersect[0].distance - wallLimit);
    }

    //cast down
    dir.set(0, -1, 0);
    pos.y += 1.5;
    this.raycaster.set(pos, dir);

    intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      this.dolly.position.copy(intersect[0].point);
    }

    //Restore the original rotation
    this.dolly.quaternion.copy(quaternion);
  }

  get selectPressed() {
    return (
      this.controllers !== undefined &&
      (this.controllers[0].userData.selectPressed ||
        this.controllers[1].userData.selectPressed)
    );
  }


  render(timestamp, frame) {
    const dt = this.clock.getDelta();

    if (this.renderer.xr.isPresenting) {
      if (this.selectPressed) {
        this.moveDolly(dt);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

export { Archi };
