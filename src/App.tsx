/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [emotion, setEmotion] = useState('Detecting...');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function setupMediaPipe() {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
      });

      const video = videoRef.current;
      if (!video) return;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.onloadeddata = () => {
        setIsInitializing(false);
        detectEmotion(faceLandmarker, video);
      };
    }

    setupMediaPipe();
  }, []);

  function detectEmotion(landmarker: FaceLandmarker, video: HTMLVideoElement) {
    const results = landmarker.detectForVideo(video, performance.now());
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Draw dots
        ctx.fillStyle = "#22d3ee";
        landmarks.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
        
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          const blendshapes = results.faceBlendshapes[0].categories;
          
          const smileLeft = blendshapes.find(b => b.categoryName === 'mouthSmileLeft')?.score || 0;
          const smileRight = blendshapes.find(b => b.categoryName === 'mouthSmileRight')?.score || 0;
          const frownLeft = blendshapes.find(b => b.categoryName === 'mouthFrownLeft')?.score || 0;
          const frownRight = blendshapes.find(b => b.categoryName === 'mouthFrownRight')?.score || 0;
          const browDownLeft = blendshapes.find(b => b.categoryName === 'browDownLeft')?.score || 0;
          const browDownRight = blendshapes.find(b => b.categoryName === 'browDownRight')?.score || 0;
          
          const avgSmile = (smileLeft + smileRight) / 2;
          const avgFrown = (frownLeft + frownRight) / 2;
          const avgAnger = (browDownLeft + browDownRight) / 2;
          
          if (avgAnger > 0.35) { // Slightly stricter for anger
            setEmotion('Angry');
          } else if (avgSmile > 0.3) {
            setEmotion('Happy');
          } else if (avgFrown > 0.4) { // Increased threshold for Sad to require more distinct frowning
            setEmotion('Sad');
          } else {
            setEmotion('Neutral');
          }
        }
      }
    }

    requestAnimationFrame(() => detectEmotion(landmarker, video));
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Live Emotion Detector</h1>
      {isInitializing && <p>Initializing Camera...</p>}
      <div className="relative">
        <video ref={videoRef} autoPlay playsInline className="hidden" width="640" height="480" />
        <canvas ref={canvasRef} width="640" height="480" className="rounded-lg shadow-lg mb-4 bg-black" />
      </div>
      <div className="text-4xl font-mono text-cyan-400">
        Status: <span className="font-bold">{emotion}</span>
      </div>
    </div>
  );
}
