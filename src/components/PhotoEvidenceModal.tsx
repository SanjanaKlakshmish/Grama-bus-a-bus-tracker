import React from 'react';
import { BusReport } from '../types/bus';
import { X, ShieldCheck, Clock, MapPin, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';

interface PhotoEvidenceModalProps {
  photoUrl: string;
  stopName: string;
  reportTime: string;
  report?: BusReport | null;
  onClose: () => void;
}

export function PhotoEvidenceModal({
  photoUrl,
  stopName,
  reportTime,
  report,
  onClose,
}: PhotoEvidenceModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">Passenger Photo Evidence</h3>
              <p className="text-[11px] text-slate-400">Captured live via camera & verified for bus</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Photo Container */}
        <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          <img
            src={photoUrl}
            alt={`Bus sighting near ${stopName}`}
            className="w-full h-full object-contain"
          />

          {/* Verification Status Overlay Badge */}
          <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-700 text-xs font-semibold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow backdrop-blur-xs">
            {report?.verification_status === 'valid' ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified Bus Sighting</span>
              </span>
            ) : report?.verification_status === 'review' ? (
              <span className="text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Under Review</span>
              </span>
            ) : report?.verification_status === 'invalid' ? (
              <span className="text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Flagged</span>
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>Verifying in Background</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer Details */}
        <div className="p-4 bg-slate-950 flex flex-col gap-3 text-xs">
          {/* Passenger Boarding Segment */}
          {report && (report.onboardingStopName || report.destinationStopName) && (
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Passenger Journey:</span>
              <div className="flex items-center gap-1.5 font-bold text-white">
                <span className="text-emerald-400">{report.onboardingStopName || report.stopName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-blue-400">{report.destinationStopName || 'Tumakuru'}</span>
              </div>
            </div>
          )}

          {/* Real Crowding & Photo Perspective */}
          {report && (
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-slate-400">Crowd / Rush Status:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  {report.occupancyStatus === 'seats_available' && '🟢 Seats Available'}
                  {report.occupancyStatus === 'standing_only' && '🟡 Standing Only'}
                  {report.occupancyStatus === 'full_rush' && '🔴 Full Rush'}
                  {!report.occupancyStatus && '🟢 Seats Available'}
                </span>

                {report.photoAngle && report.photoAngle !== 'general' && (
                  <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {report.photoAngle === 'front' && 'Front View'}
                    {report.photoAngle === 'side' && 'Side View'}
                    {report.photoAngle === 'rear' && 'Rear View'}
                    {report.photoAngle === 'interior_standing' && 'Inside / Standing'}
                    {report.photoAngle === 'window_view' && 'Window View'}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white">Sighting at {stopName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Reported at {reportTime}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic">
            * Passengers must capture real-time camera sightings without gallery uploads to keep bus reports authentic.
          </p>
        </div>
      </div>
    </div>
  );
}
