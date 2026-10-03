import React from 'react';
import { RouteStop, StopETA, BusReport } from '../types/bus';
import { Bus, CheckCircle2, Clock, Camera, Flag } from 'lucide-react';

interface StopETAListProps {
  etas: StopETA[];
  latestReport: BusReport | null;
  isJourneyEnded?: boolean;
  onSelectPhotoPreview?: (photoUrl: string, stopName: string, time: string) => void;
  onStopClick?: (stop: RouteStop) => void;
}

export function StopETAList({
  etas,
  latestReport,
  isJourneyEnded,
  onSelectPhotoPreview,
  onStopClick,
}: StopETAListProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Route Stops & Real-Time Schedule</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-progresses as travel time elapses · Ends upon reaching destination
          </p>
        </div>
        {isJourneyEnded && (
          <span className="text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Flag className="w-3 h-3 text-emerald-600" />
            <span>Trip Ended</span>
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
        {etas.map((item, index) => {
          const isCurrent = item.status === 'current';
          const isPassed = item.status === 'passed';
          const isApproaching = item.status === 'approaching';
          const isDestination = item.isDestination;

          return (
            <div
              key={item.stop.id}
              onClick={() => onStopClick && onStopClick(item.stop)}
              className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer hover:bg-slate-50/80 ${
                isCurrent ? (isDestination && isJourneyEnded ? 'bg-slate-100/90' : 'bg-emerald-50/70') : ''
              }`}
            >
              {/* Left Column: Sequence number & stop names */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isDestination && isJourneyEnded
                      ? 'bg-slate-900 text-white'
                      : isCurrent
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isPassed
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isDestination && isJourneyEnded ? (
                    <Flag className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Bus className="w-3.5 h-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        isCurrent
                          ? isDestination && isJourneyEnded
                            ? 'text-slate-900 font-bold'
                            : 'text-emerald-900 font-bold'
                          : isPassed
                          ? 'text-slate-400 line-through decoration-slate-300'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.stop.name}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      {item.stop.kannadaName}
                    </span>
                  </div>

                  {/* Clean unboxed metadata */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span>Stop #{index + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.stop.distanceFromSiraKm} km mark</span>
                    {latestReport?.stopId === item.stop.id && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-medium">Sighting reported here</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Status / Arrival Estimate */}
              <div className="text-right shrink-0">
                {isDestination && isJourneyEnded && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      🏁 Reached Destination
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Arrived at {item.passedAtTimeString || 'schedule'}
                    </span>
                  </div>
                )}

                {isCurrent && !isJourneyEnded && (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <Bus className="w-3 h-3 text-emerald-600 animate-pulse" /> At or near stop
                    </span>
                    {latestReport?.stopId === item.stop.id && latestReport.photoUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectPhotoPreview) {
                            onSelectPhotoPreview(
                              latestReport.photoUrl,
                              item.stop.name,
                              new Date(latestReport.capturedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            );
                          }
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 underline"
                      >
                        <Camera className="w-3 h-3" /> Photo
                      </button>
                    )}
                  </div>
                )}

                {isPassed && (
                  <div className="flex flex-col items-end text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Passed</span>
                    </div>
                    {item.passedAtTimeString && (
                      <span className="text-[10px] text-slate-400">~{item.passedAtTimeString}</span>
                    )}
                  </div>
                )}

                {isApproaching && (
                  <div>
                    {item.estimatedArrivalMinutes !== null ? (
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          ~{item.estimatedArrivalMinutes} mins
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.estimatedArrivalTimeString}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Awaiting report</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
        * Stop progression automatically advances as time passes. Journey marks as completed upon reaching destination.
      </div>
    </div>
  );
}
