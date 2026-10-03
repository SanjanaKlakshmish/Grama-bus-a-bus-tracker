import React, { useState, useEffect, useRef } from 'react';
import {
  Direction,
  RouteStop,
  BusReport,
  ActiveBus,
  BusOccupancyStatus,
  PhotoAngle,
} from '../types/bus';
import { getStopsForDirection, SIRA_TUMAKURU_STOPS } from '../services/routeService';
import { getCurrentRouteLocation, LocationServiceError } from '../services/locationService';
import { startCameraStream, stopCameraStream, capturePhotoFromVideo, CameraServiceError } from '../services/cameraService';
import { submitPassengerReport } from '../services/busReportService';
import {
  Camera,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  X,
  Check,
  Sparkles,
  Users,
  Clock,
  Zap,
} from 'lucide-react';

interface ReportBusViewProps {
  initialDirection: Direction;
  activeBuses?: ActiveBus[];
  onClose: () => void;
  onReportSuccess: (report: BusReport) => void;
}

type Step = 'camera_capture' | 'preview_and_confirm' | 'submitting' | 'success';

export function ReportBusView({
  initialDirection,
  activeBuses = [],
  onClose,
  onReportSuccess,
}: ReportBusViewProps) {
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [step, setStep] = useState<Step>('camera_capture');

  // Camera states (strictly live-camera only - gallery uploads prohibited)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Photo capture states
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<string>('');

  // Angle and Rush / Occupancy states
  const [occupancyStatus, setOccupancyStatus] = useState<BusOccupancyStatus>('seats_available');
  const [photoAngle, setPhotoAngle] = useState<PhotoAngle>('general');

  // Stop Selection (All 15 stops)
  const stops = getStopsForDirection(direction);
  const [selectedStopId, setSelectedStopId] = useState<string>(stops[0].id);

  // Multi-bus reporting state: New bus vs Updating an active bus
  const [isNewBusInstance, setIsNewBusInstance] = useState<boolean>(true);
  const [busIdentifier, setBusIdentifier] = useState<string>('');

  // GPS states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceToStopMeters, setDistanceToStopMeters] = useState<number>(0);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Onboarding & Destination journey section
  const [onboardingStopId, setOnboardingStopId] = useState<string>(stops[0].id);
  const [destinationStopId, setDestinationStopId] = useState<string>(stops[stops.length - 1].id);

  // Submission state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<BusReport | null>(null);

  // Keep stop IDs in sync when direction switches
  useEffect(() => {
    const currentStops = getStopsForDirection(direction);
    if (!currentStops.some((s) => s.id === selectedStopId)) {
      setSelectedStopId(currentStops[0].id);
    }
    if (!currentStops.some((s) => s.id === onboardingStopId)) {
      setOnboardingStopId(currentStops[0].id);
    }
    if (!currentStops.some((s) => s.id === destinationStopId)) {
      setDestinationStopId(currentStops[currentStops.length - 1].id);
    }
  }, [direction]);

  // 1. Initialize Camera on Mount (strictly live camera)
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setCameraLoading(true);
      setCameraError(null);
      try {
        const mediaStream = await startCameraStream();
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: unknown) {
        const camErr = err as CameraServiceError;
        setCameraError(camErr.userMessage || 'Camera permission is required to report a bus.');
      } finally {
        setCameraLoading(false);
      }
    }

    initCamera();
    fetchLocation();

    return () => {
      stopCameraStream(activeStream);
    };
  }, []);

  // Sync video ref whenever stream updates
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 2. Geolocation Fetcher
  const fetchLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const loc = await getCurrentRouteLocation();
      setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
      setSelectedStopId(loc.nearestStopResult.stop.id);
      setOnboardingStopId(loc.nearestStopResult.stop.id);
      setDistanceToStopMeters(loc.nearestStopResult.distanceMeters);
    } catch (err: unknown) {
      const locErr = err as LocationServiceError;
      setGpsError(
        locErr.userMessage || 'Select your sighting stop from the 15 route stops below.'
      );
    } finally {
      setGpsLoading(false);
    }
  };

  // 3. Instant Capture - Zero waiting for Gemini
  const handleCapture = async () => {
    if (!videoRef.current) return;
    try {
      const result = await capturePhotoFromVideo(videoRef.current);
      setCapturedBlob(result.blob);
      setCapturedPreviewUrl(result.previewUrl);
      setCapturedTimestamp(new Date().toISOString());

      // Stop camera stream to preserve battery
      stopCameraStream(stream);
      setStream(null);

      // User NEVER waits for Gemini: proceed directly to review/submission!
      setStep('preview_and_confirm');
    } catch (e) {
      console.error(e);
      setCameraError('Failed to capture photo frame. Please try again.');
      setStep('camera_capture');
    }
  };

  // 4. Retake Photo
  const handleRetake = async () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedBlob(null);
    setCapturedPreviewUrl(null);
    setSubmitError(null);
    setStep('camera_capture');

    // Restart camera
    setCameraLoading(true);
    try {
      const newStream = await startCameraStream();
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: unknown) {
      const camErr = err as CameraServiceError;
      setCameraError(camErr.userMessage || 'Camera permission is required to report a bus.');
    } finally {
      setCameraLoading(false);
    }
  };

  // 5. Submit Bus Sighting Immediately -> Show "Sighting submitted ✓"
  const handleSubmitReport = async () => {
    setSubmitError(null);

    if (!capturedBlob) {
      setSubmitError('A freshly captured camera photo is required.');
      return;
    }

    const sightingStop = stops.find((s) => s.id === selectedStopId) || stops[0];
    const onboardingStop = stops.find((s) => s.id === onboardingStopId) || sightingStop;
    const destinationStop = stops.find((s) => s.id === destinationStopId) || stops[stops.length - 1];

    setStep('submitting');

    try {
      const lat = userCoords?.latitude ?? sightingStop.latitude;
      const lon = userCoords?.longitude ?? sightingStop.longitude;

      // Save photo & GPS immediately, set verification_status = "pending", trigger Edge Function in background
      const report = await submitPassengerReport({
        direction,
        stopId: sightingStop.id,
        latitude: lat,
        longitude: lon,
        distanceToStopMeters,
        photoBlob: capturedBlob,
        capturedAt: capturedTimestamp || new Date().toISOString(),
        onboardingStopId: onboardingStop.id,
        onboardingStopName: onboardingStop.name,
        destinationStopId: destinationStop.id,
        destinationStopName: destinationStop.name,
        busIdentifier: busIdentifier.trim() || `Bus near ${sightingStop.name}`,
        isNewBusInstance,
        occupancyStatus,
        photoAngle,
      });

      setCreatedReport(report);
      setStep('success');
      onReportSuccess(report);
    } catch (e: unknown) {
      console.error('Submission failed:', e);
      setSubmitError("Report couldn't be saved. Please check your connection and try again.");
      setStep('preview_and_confirm');
    }
  };

  const selectedStop = stops.find((s) => s.id === selectedStopId) || stops[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" />
              Report Live Bus Sighting
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Camera Only · Instant Submission (Gemini verifies in background)
            </p>
          </div>
          <button
            onClick={() => {
              stopCameraStream(stream);
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Step 1: Live Camera Capture */}
          {step === 'camera_capture' && (
            <div className="flex flex-col gap-4">
              {/* Direction Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Which direction is this bus heading?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('sira_to_tumakuru')}
                    className={`h-11 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      direction === 'sira_to_tumakuru'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Sira</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Tumakuru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('tumakuru_to_sira')}
                    className={`h-11 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      direction === 'tumakuru_to_sira'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Tumakuru</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Sira</span>
                  </button>
                </div>
              </div>

              {/* Sighting Stop Selection across ALL 15 stops */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Where are you spotting this bus? (15 Stops)
                  </label>
                  <button
                    type="button"
                    onClick={fetchLocation}
                    disabled={gpsLoading}
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${gpsLoading ? 'animate-spin' : ''}`} />
                    <span>{gpsLoading ? 'Detecting...' : 'Auto GPS'}</span>
                  </button>
                </div>

                <select
                  value={selectedStopId}
                  onChange={(e) => {
                    setSelectedStopId(e.target.value);
                    setOnboardingStopId(e.target.value);
                  }}
                  className="w-full h-11 px-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {stops.map((stop, idx) => (
                    <option key={stop.id} value={stop.id}>
                      {idx + 1}. {stop.name} ({stop.kannadaName})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">
                  Currently selected: <strong>{selectedStop.name}</strong> ({selectedStop.kannadaName})
                </span>
              </div>

              {/* Guidance Note: Front, Rear, Side, or Inside */}
              <div className="text-[11px] text-slate-600 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Capture from any angle (front, rear, side, seats, or inside passenger standing area). No logo needed!
                </span>
              </div>

              {/* Live Camera Viewfinder (Live-camera only; gallery disallowed) */}
              <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center text-white flex flex-col items-center">
                    <Camera className="w-10 h-10 text-red-400 mb-2" />
                    <p className="text-xs font-semibold max-w-xs">{cameraError}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Live camera access is mandatory. Gallery and file uploads are disabled to preserve real-time sighting authenticity.
                    </p>
                  </div>
                ) : cameraLoading ? (
                  <div className="text-white text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Starting live camera...</span>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Camera Viewfinder Reticle */}
                    <div className="absolute inset-4 border-2 border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between text-[10px] text-white/80 font-mono">
                        <span>LIVE CAMERA</span>
                        <span>INSTANT REPORTING</span>
                      </div>
                      <div className="text-center text-[11px] text-white/90 bg-black/60 py-1 px-2.5 rounded-lg self-center backdrop-blur-xs">
                        Point at bus (front, side, rear, or inside)
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Capture Action Button */}
              {!cameraError && (
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={cameraLoading}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-50"
                >
                  <Camera className="w-5 h-5" />
                  Capture Live Bus Photo
                </button>
              )}
            </div>
          )}

          {/* Step 2: Preview & Confirm (Instant - User never waits for Gemini) */}
          {step === 'preview_and_confirm' && (
            <div className="flex flex-col gap-4">
              {/* Photo Preview */}
              <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-300 shadow">
                {capturedPreviewUrl && (
                  <img
                    src={capturedPreviewUrl}
                    alt="Captured bus sighting"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Instant Status Badge */}
                <div className="absolute top-3 left-3 bg-emerald-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow border border-emerald-500/40">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant Submission Ready</span>
                </div>
              </div>

              {/* Zero-wait notice */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Photo ready! Sighting goes live on the route immediately while Gemini verifies in the background.
                </span>
              </div>

              {/* Real Data: Crowding & Rush Status Selector */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  What is the crowding / rush status inside the bus?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOccupancyStatus('seats_available')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      occupancyStatus === 'seats_available'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-sm">🟢</span>
                    <span className="text-xs">Seats Available</span>
                    <span className="text-[10px] text-slate-500">ಆಸನ ಲಭ್ಯ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOccupancyStatus('standing_only')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      occupancyStatus === 'standing_only'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-sm">🟡</span>
                    <span className="text-xs">Standing Only</span>
                    <span className="text-[10px] text-slate-500">ನಿಂತು ಪ್ರಯಾಣ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOccupancyStatus('full_rush')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      occupancyStatus === 'full_rush'
                        ? 'bg-red-50 border-red-600 ring-2 ring-red-500/20 text-red-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-sm">🔴</span>
                    <span className="text-xs">Full Rush</span>
                    <span className="text-[10px] text-slate-500">ವಿಪರೀತ ರಶ್</span>
                  </button>
                </div>
              </div>

              {/* Photo Perspective Selector */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  Photo Angle / Perspective:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                  {[
                    { id: 'front', label: 'Front View' },
                    { id: 'side', label: 'Side View' },
                    { id: 'rear', label: 'Rear / Back' },
                    { id: 'interior_standing', label: 'Inside / Standing' },
                    { id: 'window_view', label: 'Window View' },
                  ].map((ang) => (
                    <button
                      key={ang.id}
                      type="button"
                      onClick={() => setPhotoAngle(ang.id as PhotoAngle)}
                      className={`py-1.5 px-2 rounded-lg border text-center text-[11px] font-semibold transition-all ${
                        photoAngle === ang.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Route Direction:</span>
                  <span className="font-bold text-slate-800">
                    {direction === 'sira_to_tumakuru' ? 'Sira → Tumakuru' : 'Tumakuru → Sira'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Sighting Stop:</span>
                  <div className="text-right">
                    <span className="font-bold text-emerald-800">{selectedStop.name}</span>
                    <span className="text-[11px] text-slate-500 block">({selectedStop.kannadaName})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Crowd / Rush Status:</span>
                  <span className="font-bold">
                    {occupancyStatus === 'seats_available' && '🟢 Seats Available'}
                    {occupancyStatus === 'standing_only' && '🟡 Standing Only'}
                    {occupancyStatus === 'full_rush' && '🔴 Full Rush'}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action Buttons: Retake vs Submit */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Submit Sighting
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Submitting */}
          {step === 'submitting' && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
              <h3 className="text-base font-bold text-slate-900">Saving Sighting & GPS Coordinates...</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Saving photo to Supabase immediately.
              </p>
            </div>
          )}

          {/* Step 4: Success confirmation -> "Sighting submitted ✓" */}
          {step === 'success' && createdReport && (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Sighting submitted ✓</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs">
                Photo and GPS coordinates saved immediately. Gemini is verifying the sighting in the background.
              </p>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Stop:</span>
                  <span className="font-bold text-slate-800">{createdReport.stopName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Live Status:</span>
                  <span className="font-semibold text-emerald-700">Active on Corridor Map</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification:</span>
                  <span className="font-semibold text-amber-700">⏳ Verifying in Background</span>
                </div>
              </div>

              <div className="mt-6 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center"
                >
                  View on Live Tracker
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
