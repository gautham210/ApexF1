import { useEffect, useRef, useState } from "react";
import type { CarEntry } from "@/lib/museum";
import { validatedModel, modelResourceUrl } from "@/lib/museum";
export default function CarViewer({ car }: { car: CarEntry }) {
  const container = useRef<HTMLDivElement>(null);
  const actions = useRef<{
    rotate: (n: number) => void;
    zoom: (n: number) => void;
    reset: () => void;
  } | null>(null);
  const [status, setStatus] = useState("Model not supplied");
  const [load, setLoad] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const model = validatedModel(car.model);
  useEffect(() => {
    if (!load || !model || !container.current) return;
    let disposed = false;
    const abort = new AbortController();
    let clean = () => {};
    setStatus("Loading model…");
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (disposed) return;
      const host = container.current!;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
      camera.position.set(5, 3, 5);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3));
      const sun = new THREE.DirectionalLight(0xffffff, 3);
      sun.position.set(3, 6, 4);
      scene.add(sun);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      const render = () => {
        if (!disposed) renderer.render(scene, camera);
      };
      controls.addEventListener("change", render);
      const resize = () => {
        renderer.setSize(host.clientWidth, 320);
        camera.aspect = host.clientWidth / 320;
        camera.updateProjectionMatrix();
        render();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const disposeObject = (object: import("three").Object3D) =>
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of materials) {
              for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
              m.dispose();
            }
          }
        });
      clean = () => {
        observer.disconnect();
        controls.dispose();
        disposeObject(scene);
        renderer.dispose();
        renderer.domElement.remove();
        actions.current = null;
      };
      const response = await fetch(model.url, { signal: abort.signal });
      if (!response.ok) throw new Error("Model request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming unavailable");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 25000000) {
          await reader.cancel();
          throw new Error("Model exceeds 25 MB budget");
        }
        chunks.push(value);
        if (!disposed) setStatus(`Loading model · ${Math.round(bytes / 1024)} KB`);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => modelResourceUrl(url, location.origin));
      const loader = new GLTFLoader(manager);
      const gltf = await loader.parseAsync(
        buffer.buffer,
        location.origin + model.url.slice(0, model.url.lastIndexOf("/") + 1),
      );
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      const box = new THREE.Box3().setFromObject(gltf.scene);
      if (box.isEmpty()) {
        disposeObject(gltf.scene);
        throw new Error("Empty model");
      }
      const size = box.getSize(new THREE.Vector3()).length();
      if (!Number.isFinite(size) || size <= 0) {
        disposeObject(gltf.scene);
        throw new Error("Invalid model");
      }
      gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
      gltf.scene.scale.setScalar(4 / size);
      scene.add(gltf.scene);
      actions.current = {
        rotate: (n) => {
          const point = camera.position.clone();
          point.applyAxisAngle(new THREE.Vector3(0, 1, 0), n);
          camera.position.copy(point);
          controls.update();
          render();
        },
        zoom: (n) => {
          camera.position.multiplyScalar(n);
          controls.update();
          render();
        },
        reset: () => {
          camera.position.set(5, 3, 5);
          controls.target.set(0, 0, 0);
          controls.update();
          render();
        },
      };
      setStatus("Model loaded — drag to orbit, scroll or use controls to zoom");
      render();
    })().catch(() => {
      clean();
      if (!disposed) setStatus("Model unavailable — WebGL, asset or format could not be loaded.");
    });
    return () => {
      disposed = true;
      abort.abort();
      clean();
    };
  }, [load, model, attempt]);
  return (
    <div className="glass rounded-2xl p-5">
      <div
        ref={container}
        className="min-h-40 overflow-hidden"
        aria-label={`${car.name} model viewer`}
      >
        {!load && (
          <div className="h-40 grid place-items-center border border-dashed border-border rounded-xl">
            <span className="font-display text-4xl text-muted-foreground">
              {car.year} / {car.name}
            </span>
          </div>
        )}
      </div>
      <p role="status" className="text-sm my-3">
        {model
          ? status
          : "Model not supplied — typographic placeholder, no authentic car geometry shown."}
      </p>
      {model && (
        <>
          <button
            className="p-3 border rounded-lg"
            onClick={() => {
              setLoad(true);
              setAttempt((a) => a + 1);
            }}
          >
            Load reviewed model
          </button>
          <div className="flex flex-wrap gap-2">
            {[
              ["Rotate left", () => actions.current?.rotate(-0.2)],
              ["Rotate right", () => actions.current?.rotate(0.2)],
              ["Zoom in", () => actions.current?.zoom(0.9)],
              ["Zoom out", () => actions.current?.zoom(1.1)],
              ["Reset camera", () => actions.current?.reset()],
              [
                "Fullscreen",
                () => {
                  void container.current
                    ?.requestFullscreen?.()
                    .catch(() => setStatus("Fullscreen unavailable"));
                },
              ],
            ].map(([label, fn]) => (
              <button
                key={String(label)}
                disabled={!actions.current}
                className="p-3 border rounded-lg disabled:opacity-40"
                onClick={fn as () => void}
              >
                {String(label)}
              </button>
            ))}
          </div>
          <p className="text-xs my-2">
            {model.credit} · {model.license}
          </p>
        </>
      )}
    </div>
  );
}
