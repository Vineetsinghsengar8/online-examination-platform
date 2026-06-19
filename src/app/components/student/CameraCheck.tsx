import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const CameraCheck: React.FC<{ onVerified: () => void; onBack: () => void }> = ({ onVerified, onBack }) => {
  const webcamRef = useRef<Webcam>(null);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleUserMedia = () => {
    setCameraAllowed(true);
    toast.success('Camera access granted');
  };

  const handleUserMediaError = () => {
    setCameraAllowed(false);
    toast.error('Camera access denied. Please enable it in browser settings.');
  };

  const performCheck = () => {
    setChecking(true);
    // Simulate AI check (Face detection would go here)
    setTimeout(() => {
      setChecking(false);
      onVerified();
    }, 1500);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full space-y-8 text-center">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Check</h2>
        <p className="text-gray-500 mt-2">We need to verify your camera and environment before starting.</p>
      </div>

      <div className="bg-black rounded-lg overflow-hidden h-64 md:h-80 relative flex items-center justify-center">
        {!cameraAllowed && (
          <div className="text-white flex flex-col items-center p-6">
            <Camera size={48} className="mb-4 text-gray-400" />
            <p>Waiting for camera access...</p>
            <p className="text-sm text-gray-400 mt-2">Click "Allow" in your browser popup</p>
          </div>
        )}
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className={`w-full h-full object-cover ${!cameraAllowed ? 'hidden' : 'block'}`}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
        />
        {cameraAllowed && !checking && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2 backdrop-blur-sm">
            <Check size={14} />
            <span>Camera Active</span>
          </div>
        )}
      </div>

      {!cameraAllowed ? (
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-left flex items-start space-x-3">
          <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-orange-800">
            <p className="font-bold">Camera Access Required</p>
            <p className="mt-1">If you denied access, please click the lock icon in your browser address bar, reset permissions, and refresh the page.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Ensure your face is clearly visible and centered. The system monitors your presence throughout the exam.
        </p>
      )}

      <div className="flex space-x-4">
        <button 
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Back
        </button>
        <button 
          onClick={performCheck}
          disabled={!cameraAllowed || checking}
          className={`flex-1 py-3 rounded-lg text-white font-bold transition-all ${
            cameraAllowed && !checking 
              ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {checking ? 'Verifying...' : 'Start Exam'}
        </button>
      </div>
    </div>
  );
};
