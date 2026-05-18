export interface Transform3D {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
}

export interface Model3DAsset {
	id: string;
	name: string;
	url: string;
	format: "gltf" | "glb" | "obj" | "fbx" | "ply" | "splat";
	sizeBytes: number;
	boundingBox?: { min: [number, number, number]; max: [number, number, number] };
}

export interface Layer3DConfig {
	modelId: string;
	transform: Transform3D;
	material: Material3D;
	animation?: Animation3D;
	visible: boolean;
}

export interface Material3D {
	color: string;
	metalness: number;
	roughness: number;
	opacity: number;
	textureUrl?: string;
	normalMapUrl?: string;
	emissiveColor?: string;
	emissiveIntensity?: number;
}

export interface Animation3D {
	type: "rotate" | "spin" | "bounce" | "float" | "pulse" | "orbit";
	speed: number;
	axis: "x" | "y" | "z";
	loop: boolean;
}

export interface ThreeSceneHandle {
	id: string;
	canvas: OffscreenCanvas;
	renderer: unknown;
	scene: unknown;
	camera: unknown;
	models: Map<string, Model3DAsset>;
	layers: Map<string, Layer3DConfig>;
}

export class ThreeLayerManager {
	private scenes: Map<string, ThreeSceneHandle> = new Map();
	private threeLoaded = false;
	private loadPromise: Promise<void> | null = null;

	async loadThree(): Promise<void> {
		if (this.threeLoaded) return;
		if (this.loadPromise) return this.loadPromise;

		this.loadPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
			script.onload = () => {
				this.threeLoaded = true;
				resolve();
			};
			script.onerror = () => reject(new Error("Failed to load Three.js"));
			document.head.appendChild(script);
		});

		return this.loadPromise;
	}

	async createScene(id: string, width: number, height: number): Promise<ThreeSceneHandle> {
		await this.loadThree();

		const canvas = new OffscreenCanvas(width, height);
		const THREE = (window as any).THREE;

		const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
		renderer.setSize(width, height);
		renderer.setClearColor(0x000000, 0);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
		camera.position.set(0, 0, 5);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(5, 5, 5);
		scene.add(directionalLight);

		const handle: ThreeSceneHandle = {
			id,
			canvas,
			renderer,
			scene,
			camera,
			models: new Map(),
			layers: new Map(),
		};

		this.scenes.set(id, handle);
		return handle;
	}

	async loadModel(sceneId: string, asset: Model3DAsset): Promise<void> {
		const scene = this.scenes.get(sceneId);
		if (!scene) throw new Error(`Scene ${sceneId} not found`);

		const THREE = (window as any).THREE;
		const loader = new THREE.GLTFLoader();

		await new Promise<void>((resolve, reject) => {
			loader.load(asset.url, (gltf: any) => {
				const model = gltf.scene;
				model.userData = { assetId: asset.id };
				scene.scene.add(model);
				scene.models.set(asset.id, asset);
				resolve();
			}, undefined, reject);
		});
	}

	updateLayerTransform(sceneId: string, layerId: string, transform: Transform3D): void {
		const scene = this.scenes.get(sceneId);
		if (!scene) return;

		const model = scene.scene.getObjectByName(layerId);
		if (!model) return;

		model.position.set(transform.position.x, transform.position.y, transform.position.z);
		model.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
		model.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
	}

	async renderFrame(sceneId: string): Promise<ImageBitmap> {
		const scene = this.scenes.get(sceneId);
		if (!scene) throw new Error(`Scene ${sceneId} not found`);

		(scene.renderer as any).render(scene.scene, scene.camera);
		return scene.canvas.transferToImageBitmap();
	}

	disposeScene(sceneId: string): void {
		const scene = this.scenes.get(sceneId);
		if (scene) {
			(scene.renderer as any).dispose();
			this.scenes.delete(sceneId);
		}
	}
}

export const threeLayerManager = new ThreeLayerManager();
