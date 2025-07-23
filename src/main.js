import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Variables globales para el reinicio
let mindarThree = null;
let isRunning = false;
let restartButtonListener = null;

// Cargamos el sonido globalmente
const roarAudio = new Audio('/sounds/roar.mp3');

window.start = async () => {
  // Si ya está corriendo, detener primero
  if (isRunning && mindarThree) {
    await stopAR();
  }

  mindarThree = new MindARThree({
    container: document.querySelector("#ar-container"),
    imageTargetSrc: "/mind/targets.mind",
  });

  const { renderer, scene, camera } = mindarThree;

  // Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Anclas y modelos
  const anchors = [
    mindarThree.addAnchor(0),
    mindarThree.addAnchor(1),
    mindarThree.addAnchor(2),
    mindarThree.addAnchor(3),
  ];

  const loader = new GLTFLoader();
  const loadModel = (url, scale = 0.1) => {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(scale, scale, scale);
          resolve(model);
        },
        undefined,
        (error) => reject(error)
      );
    });
  };

  try {
    const models = await Promise.all([
      loadModel("/models/brachiosaurus.glb", 0.1),
      loadModel("/models/trex.glb", 0.1),
      loadModel("/models/triceratops.glb", 1), // ← Aquí lo haces más grande
      loadModel("/models/velociraptor.glb", 0.1),
    ]);

    anchors.forEach((anchor, i) => {
      anchor.group.add(models[i]);
    });

    // Etiquetas originales (mantenemos compatibilidad pero las ocultamos)
    const labels = [
      document.getElementById('label-brachiosaurus'),
      document.getElementById('label-trex'),
      document.getElementById('label-triceratops'),
      document.getElementById('label-velociraptor'),
    ];

    // Mostrar/Ocultar según el marcador CON NUEVAS FUNCIONES DE UI
    anchors.forEach((anchor, i) => {
      anchor.onTargetFound = () => {
        // Funcionalidad original
        labels[i].style.display = 'block';
        document.getElementById('restart-button').classList.add('hidden');
        roarAudio.currentTime = 0;
        roarAudio.play();

        // NUEVAS FUNCIONES DE UI
        // Mostrar panel de información
        if (window.showDinoInfo) {
          window.showDinoInfo(i);
        }
      };

      anchor.onTargetLost = () => {
        // Funcionalidad original
        labels[i].style.display = 'none';
        document.getElementById('restart-button').classList.remove('hidden');
        roarAudio.pause();
        roarAudio.currentTime = 0;

        // NUEVAS FUNCIONES DE UI
        // Ocultar panel de información
        if (window.hideDinoInfo) {
          window.hideDinoInfo();
        }
      };
    });

    await mindarThree.start();
    isRunning = true;

    renderer.setAnimationLoop(() => {
      if (isRunning) {
        models.forEach((model) => {
          model.rotation.y += 0.01;
        });
        renderer.render(scene, camera);
      }
    });

    // Mostrar botón por primera vez
    document.getElementById('restart-button').classList.remove('hidden');

    // Configurar botón de reinicio (solo una vez)
    setupRestartButton();

  } catch (error) {
    console.error('Error cargando modelos:', error);

    // Mostrar error en la UI de escaneo
    const searchText = document.querySelector('.search-text');
    if (searchText) {
      searchText.textContent = '❌ Error cargando modelos';
      searchText.style.color = '#ff6b6b';
    }
  }
};

// Función para detener AR correctamente
const stopAR = async () => {
  if (mindarThree && isRunning) {
    isRunning = false;

    try {
      await mindarThree.stop();

      const video = mindarThree.video;
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }

      if (mindarThree.renderer) {
        mindarThree.renderer.setAnimationLoop(null);
        mindarThree.renderer.clear();
      }

      const labels = document.querySelectorAll('.label');
      labels.forEach(label => {
        label.style.display = 'none';
      });

      // Ocultar panel de información si está visible
      if (window.hideDinoInfo) {
        window.hideDinoInfo();
      }

    } catch (error) {
      console.error('Error deteniendo AR:', error);
    }
  }
};

// Función para configurar el botón de reinicio (evita múltiples listeners)
const setupRestartButton = () => {
  const restartButton = document.getElementById('restart-button');

  if (restartButtonListener) {
    restartButton.removeEventListener('click', restartButtonListener);
  }

  restartButtonListener = async () => {
    console.log('Reiniciando escaneo...');

    restartButton.classList.add('hidden');
    const originalText = restartButton.textContent;
    restartButton.textContent = '⏳ Reiniciando...';
    restartButton.disabled = true;

    try {
      await stopAR();

      // Resetear UI de escaneo
      const searchText = document.querySelector('.search-text');
      if (searchText) {
        searchText.textContent = '🔍 Buscando marcadores...';
        searchText.style.color = '#00b894';
      }

      setTimeout(async () => {
        await window.start();
        restartButton.textContent = originalText;
        restartButton.disabled = false;
      }, 500);

    } catch (error) {
      console.error('Error en reinicio:', error);
      restartButton.classList.remove('hidden');
      restartButton.textContent = originalText;
      restartButton.disabled = false;
    }
  };

  restartButton.addEventListener('click', restartButtonListener);
};