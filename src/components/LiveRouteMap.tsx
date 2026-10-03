import React, { useState } from 'react';
import { RouteStop, Direction, StopETA, ActiveBus } from '../types/bus';
import { getStopsForDirection } from '../services/routeService';
import { MapPin, Navigation, Bus, Eye, Flag, ArrowRight, ShieldCheck } from 'lucide-react';

interface LiveRouteMapProps {
  direction: Direction;
  activeBuses?: ActiveBus[];
  primaryBus?: ActiveBus | null;
  selectedBusJourneyId?: string | null;
  onSelectBus?: (journeyId: string) => void;
  etas: StopETA[];
  userLocation: { latitude: number; longitude: number } | null;
  onRequestUserLocation?: () => void;
  onSelectPhotoPreview?: (photoUrl: string, stopName: string, time: string) => void;
}

export function LiveRouteMap({
  direction,
  activeBuses = [],
  primaryBus = null,
  selectedBusJourneyId = null,
  onSelectBus,
  etas,
  userLocation,
  onRequestUserLocation,
  onSelectPhotoPreview,
}: LiveRouteMapProps) {
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [selectedBusForInfo, setSelectedBusForInfo] = useState<ActiveBus | null>(null);

  const stops = getStopsForDirection(direction);
  const currentBus = activeBuses.find((b) => b.journeyId === selectedBusJourneyId) || primaryBus;

  // Calculate percentage along route (0 to 100%) for a given stop index
  const getStopPositionPercent = (index: number) => {
    return Math.round((index / (stops.length - 1)) * 100);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-950 text-white flex flex-col justify-between">
      {/* 1. Header Bar: Corridor Overview */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {direction === 'sira_to_tumakuru' ? 'Sira → Tumakuru' : 'Tumakuru → Sira'}
              </span>
              <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                NH 48 · 51.5 km
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              100% Free Live Corridor Visualizer · 15 Scheduled Stops
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {activeBuses.length > 0
                ? `${activeBuses.length} Active ${activeBuses.length === 1 ? 'Bus' : 'Buses'}`
                : 'Awaiting Sightings'}
            </span>
          </span>

          <button
            type="button"
            onClick={onRequestUserLocation}
            className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-slate-200 font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Locate my position on route"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">My Location</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Route Graphic Canvas */}
      <div className="p-4 sm:p-6 overflow-x-auto my-2">
        <div className="min-w-[700px] relative py-12 px-6">
          {/* Highway Base Track (Dual carriageway highway representation) */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-3 bg-slate-800 rounded-full border border-slate-700" />
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 border-t border-dashed border-slate-600 pointer-events-none" />

          {/* Active Bus Progress Fill */}
          {currentBus && (
            <div
              className="absolute left-8 top-1/2 -translate-y-1/2 h-3 bg-emerald-500/40 rounded-full transition-all duration-700 pointer-events-none"
              style={{
                width: `${Math.max(
                  4,
                  (stops.findIndex((s) => s.id === currentBus.currentCalculatedStop.id) /
                    (stops.length - 1)) *
                    100
                )}%`,
              }}
            />
          )}

          {/* 15 Stop Pins along the Highway */}
          <div className="relative flex items-center justify-between">
            {stops.map((stop, idx) => {
              const isSelected = selectedStop?.id === stop.id;
              const eta = etas.find((e) => e.stop.id === stop.id);
              const isDestination = idx === stops.length - 1;

              // Check if any active bus is currently at or near this stop
              const busAtStop = activeBuses.find((b) => b.currentCalculatedStop.id === stop.id);

              return (
                <div key={stop.id} className="relative flex flex-col items-center group">
                  {/* Top: Stop Number & Pin */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStop(stop);
                      if (busAtStop) {
                        setSelectedBusForInfo(busAtStop);
                        if (onSelectBus) onSelectBus(busAtStop.journeyId);
                      }
                    }}
                    className={`relative z-20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      busAtStop
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/40 scale-125 shadow-lg'
                        : isSelected
                        ? 'bg-white text-slate-900 ring-4 ring-blue-500/50 scale-110'
                        : isDestination
                        ? 'bg-slate-900 border-2 border-emerald-400 text-emerald-400'
                        : eta?.status === 'passed'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-slate-800 text-slate-200 border border-slate-600 hover:scale-110 hover:border-emerald-400'
                    }`}
                  >
                    {busAtStop ? (
                      <Bus className="w-4 h-4 animate-pulse" />
                    ) : isDestination ? (
                      '🏁'
                    ) : (
                      idx + 1
                    )}
                  </button>

                  {/* Active Bus Floating Label above Stop */}
                  {busAtStop && (
                    <div className="absolute -top-10 whitespace-nowrap bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-bounce flex items-center gap-1 z-30">
                      <Bus className="w-3 h-3" />
                      <span>{busAtStop.busLabel}</span>
                    </div>
                  )}

                  {/* Bottom: Stop Names & Distance Mark */}
                  <div className="absolute top-10 flex flex-col items-center text-center max-w-[80px]">
                    <span
                      className={`text-[11px] leading-tight font-semibold truncate max-w-[76px] ${
                        busAtStop
                          ? 'text-emerald-400 font-bold'
                          : isSelected
                          ? 'text-white'
                          : 'text-slate-300'
                      }`}
                    >
                      {stop.name}
                    </span>
                    <span className="text-[9px] text-slate-500 truncate max-w-[76px]">
                      {stop.kannadaName}
                    </span>

                    {/* ETA or Status */}
                    {eta?.status === 'approaching' && eta.estimatedArrivalMinutes !== null && !busAtStop && (
                      <span className="text-[10px] text-amber-400 font-bold mt-0.5">
                        ~{eta.estimatedArrivalMinutes}m
                      </span>
                    )}
                    {eta?.status === 'passed' && (
                      <span className="text-[9px] text-slate-500 mt-0.5">Passed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Selected Stop or Active Bus Detail Drawer */}
      {(selectedStop || selectedBusForInfo) && (
        <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3 z-10">
          {selectedStop && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{selectedStop.name}</span>
                  <span className="text-xs text-slate-400">({selectedStop.kannadaName})</span>
                  <span className="text-[11px] text-slate-500">
                    · Stop #{stops.findIndex((s) => s.id === selectedStop.id) + 1} ({selectedStop.distanceFromSiraKm} km mark)
                  </span>
                </div>

                <div className="text-xs text-slate-300 mt-0.5">
                  {(() => {
                    const busHere = activeBuses.find((b) => b.currentCalculatedStop.id === selectedStop.id);
                    const eta = etas.find((e) => e.stop.id === selectedStop.id);

                    if (busHere) {
                      const occLabel =
                        busHere.occupancyStatus === 'seats_available'
                          ? '🟢 Seats Available'
                          : busHere.occupancyStatus === 'standing_only'
                          ? '🟡 Standing Only'
                          : '🔴 Full Rush';

                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <Bus className="w-3.5 h-3.5" />
                            {busHere.busLabel} is currently here!
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-white">
                            {occLabel}
                          </span>
                        </div>
                      );
                    }
                    if (eta?.status === 'passed') {
                      return <span className="text-slate-400">Bus already passed this stop (~{eta.passedAtTimeString || 'earlier'}).</span>;
                    }
                    if (eta?.status === 'approaching' && eta.estimatedArrivalMinutes !== null) {
                      return (
                        <span className="text-amber-400">
                          Estimated bus arrival: <strong>~{eta.estimatedArrivalMinutes} minutes</strong> (around {eta.estimatedArrivalTimeString})
                        </span>
                      );
                    }
                    return <span className="text-slate-400">Awaiting passenger sighting for this stop.</span>;
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {selectedBusForInfo?.latestReport?.photoUrl && (
              <button
                type="button"
                onClick={() =>
                  onSelectPhotoPreview &&
                  onSelectPhotoPreview(
                    selectedBusForInfo.latestReport.photoUrl,
                    selectedBusForInfo.reportedStop.name,
                    new Date(selectedBusForInfo.latestReport.capturedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  )
                }
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Passenger Photo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedStop(null);
                setSelectedBusForInfo(null);
              }}
              className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 4. Footer Status Bar */}
      <div className="p-3 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            {activeBuses.length > 0
              ? `Tracking ${activeBuses.length} real Karnataka bus(es) en route`
              : 'No buses currently reported along NH 48 corridor'}
          </span>
        </div>
        <div className="text-slate-500">
          100% Free · No API Keys or Licensing Required
        </div>
      </div>
    </div>
  );
}
