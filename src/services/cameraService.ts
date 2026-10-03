export interface CameraCaptureResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

export type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'NOT_SUPPORTED'
  | 'STREAM_FAILED'
  | 'UNKNOWN';

export interface CameraServiceError {
  code: CameraErrorCode;
  userMessage: string;
}

/**
 * Initializes the camera stream using the environment-facing (back) camera if available.
 */
export async function startCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const error: CameraServiceError = {
      code: 'NOT_SUPPORTED',
      userMessage: 'Direct camera access is not supported on this browser or requires a secure HTTPS connection.',
    };
    throw error;
  }

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    let code: CameraErrorCode = 'UNKNOWN';
    let userMessage = 'Unable to access the camera. Please check your camera permissions.';

    if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
      code = 'PERMISSION_DENIED';
      userMessage = 'Camera permission is required to report a bus. Please enable camera access in your browser settings.';
    } else if (errorObj.name === 'NotFoundError' || errorObj.name === 'DevicesNotFoundError') {
      code = 'NOT_FOUND';
      userMessage = 'No camera device found on your device.';
    } else if (errorObj.name === 'NotReadableError' || errorObj.name === 'TrackStartError') {
      code = 'STREAM_FAILED';
      userMessage = 'Camera is currently in use by another application. Please close other camera apps and retry.';
    }

    const serviceError: CameraServiceError = { code, userMessage };
    throw serviceError;
  }
}

/**
 * Stops all tracks in an active media stream.
 */
export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Captures a single still photo frame from an active HTMLVideoElement onto a canvas
 * and returns both the image Blob and local preview URL.
 */
export async function capturePhotoFromVideo(videoElement: HTMLVideoElement): Promise<CameraCaptureResult> {
  if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    throw new Error('Video stream is not ready for capture.');
  }

  const canvas = document.createElement('canvas');
  // Maximum dimension constraint for mobile network efficiency
  const maxDim = 1280;
  let width = videoElement.videoWidth;
  let height = videoElement.videoHeight;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context for photo capture.');
  }

  // Draw current video frame
  ctx.drawImage(videoElement, 0, 0, width, height);

  return new Promise<CameraCaptureResult>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode captured photo.'));
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        resolve({
          blob,
          previewUrl,
          width,
          height,
        });
      },
      'image/jpeg',
      0.85
    );
  });
}
