import React from 'react';
import { RouteStop, Direction, BusReport, StopETA, ActiveBus } from '../types/bus';
import { calculateDistanceMeters } from '../services/routeService';
import { calculateCorridorFare } from '../services/fareService';
import { MapPin, Navigation, ArrowRight, Clock, Banknote, ShieldAlert, Bus, CheckCircle2, Camera } from 'lucide-react';

interface PassengerJourneyPlannerProps {
  direction: Direction;
  stops: RouteStop[];
  activeBuses: ActiveBus[];
  primaryBus: ActiveBus | null;
  onboardingStopId: string;
  destinationStopId: string;
  selectedBusJourneyId?: string | null;
  onSelectBusJourney?: (journeyId: string) => void;
  onChangeOnboarding: (stopId: string) => void;
  onChangeDestination: (stopId: string) => void;
  onOpenReportModal: () => void;
}

export function PassengerJourneyPlanner({
  direction,
  stops,
  activeBuses,
  primaryBus,
  onboardingStopId,
  destinationStopId,
  selectedBusJourneyId,
  onSelectBusJourney,
  onChangeOnboarding,
  onChangeDestination,
  onOpenReportModal,
}: PassengerJourneyPlannerProps) {
  const onboardingStop = stops.find((s) => s.id === onboardingStopId) || stops[0];
  const destinationStop = stops.find((s) => s.id === destinationStopId) || stops[stops.length - 1];

  const onboardingIndex = stops.findIndex((s) => s.id === onboardingStop.id);
  const destinationIndex = stops.findIndex((s) => s.id === destinationStop.id);

  // Exact benchmarked fare: Sira = approx. ₹60, Kallambella = approx. ₹46
  const fareResult = calculateCorridorFare(onboardingStop.id, destinationStop.id);

  // Active bus currently focused
  const currentBus = activeBuses.find((b) => b.journeyId === selectedBusJourneyId) || primaryBus;

  // Onboarding stop ETA for the focused bus
  const onboardingEta = currentBus?.etas.find((e) => e.stop.id === onboardingStop.id);
  const destinationEta = currentBus?.etas.find((e) => e.stop.id === destinationStop.id);

  // Latest bus stop index
  const busStopIndex = currentBus ? stops.findIndex((s) => s.id === currentBus.reportedStop.id) : -1;

  // Relative status
  let busRelation = 'unknown';
  let stopsAway = 0;
  if (busStopIndex !== -1) {
    if (busStopIndex < onboardingIndex) {
      busRelation = 'approaching_onboarding';
      stopsAway = onboardingIndex - busStopIndex;
    } else if (busStopIndex === onboardingIndex) {
      busRelation = 'at_onboarding';
    } else {
      busRelation = 'passed_onboarding';
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" />
            Where are you onboarding & where are you going?
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select your boarding stop and destination · View live multiple bus sightings & approximate fares
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenReportModal}
          className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-xs"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Report Bus at My Stop</span>
        </button>
      </div>

      {/* Selectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
        {/* Onboarding Selector */}
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            1. Where are you onboarding?
          </label>
          <select
            value={onboardingStop.id}
            onChange={(e) => onChangeOnboarding(e.target.value)}
            className="w-full h-11 px-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {stops.map((stop, idx) => (
              <option key={stop.id} value={stop.id}>
                {idx + 1}. {stop.name} ({stop.kannadaName})
              </option>
            ))}
          </select>
        </div>

        {/* Destination Selector */}
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            2. Where are you going?
          </label>
          <select
            value={destinationStop.id}
            onChange={(e) => onChangeDestination(e.target.value)}
            className="w-full h-11 px-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {stops.map((stop, idx) => {
              const isPastOnboarding = idx > onboardingIndex;
              return (
                <option key={stop.id} value={stop.id} disabled={idx <= onboardingIndex}>
                  {idx + 1}. {stop.name} {idx <= onboardingIndex ? '(Prior stop)' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Multiple Buses Approach Selector (if more than 1 active bus on route) */}
      {activeBuses.length > 1 && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-emerald-600" />
              Multiple Buses Spotted on this Route ({activeBuses.length} Active):
            </span>
            <span className="text-[11px] text-slate-500">Tap to track a specific bus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeBuses.map((bus) => {
              const isSelected = (currentBus?.journeyId || primaryBus?.journeyId) === bus.journeyId;
              const etaToBoarding = bus.etas.find((e) => e.stop.id === onboardingStop.id);

              return (
                <button
                  key={bus.journeyId}
                  type="button"
                  onClick={() => onSelectBusJourney && onSelectBusJourney(bus.journeyId)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{bus.busLabel}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                        {bus.occupancyStatus === 'seats_available'
                          ? '🟢 Seats Avail'
                          : bus.occupancyStatus === 'standing_only'
                          ? '🟡 Standing'
                          : '🔴 Full Rush'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Spotted near {bus.reportedStop.name} ({bus.minutesSinceReport}m ago)
                    </span>
                  </div>

                  <div className="text-right">
                    {etaToBoarding?.status === 'approaching' && etaToBoarding.estimatedArrivalMinutes !== null ? (
                      <span className="text-xs font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 block">
                        ~{etaToBoarding.estimatedArrivalMinutes}m
                      </span>
                    ) : etaToBoarding?.status === 'current' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded block">
                        At your stop
                      </span>
                    ) : etaToBoarding?.status === 'passed' ? (
                      <span className="text-[10px] text-slate-400 block">Passed your stop</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block">Approaching</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic Journey Card & Approximate Fares */}
      {destinationIndex > onboardingIndex ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-3">
          {/* Top route overview */}
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60 flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-950">
              <span>{onboardingStop.name}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>{destinationStop.name}</span>
            </div>

            {/* Approximate Fare breakdown */}
            <div className="flex items-center gap-3 text-slate-700 font-medium">
              <span>{fareResult.distanceKm} km</span>
              <span aria-hidden="true">·</span>
              <span>{destinationIndex - onboardingIndex} stops</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-900 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300">
                {fareResult.fareFormatted}
              </span>
            </div>
          </div>

          {/* Sighting Status relative to passenger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {busRelation === 'approaching_onboarding' && onboardingEta?.estimatedArrivalMinutes && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Bus className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>Bus approaching your stop ({onboardingStop.name})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Currently near{' '}
                    <strong className="text-slate-900">{currentBus?.reportedStop.name}</strong> ({stopsAway}{' '}
                    {stopsAway === 1 ? 'stop' : 'stops'} away).
                  </p>
                </div>
              )}

              {busRelation === 'at_onboarding' && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bus is at or near {onboardingStop.name}!</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Prepare to board or take a real-time photo to update other passengers.
                  </p>
                </div>
              )}

              {busRelation === 'passed_onboarding' && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Selected bus already passed {onboardingStop.name}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Last sighting is further ahead near{' '}
                    <strong className="text-slate-900">{currentBus?.reportedStop.name}</strong>.
                  </p>
                </div>
              )}

              {busRelation === 'unknown' && (
                <p className="text-xs text-slate-600">
                  {activeBuses.length > 0
                    ? `Tracking ${currentBus?.busLabel || 'active bus'} along route.`
                    : 'No active bus spotted yet. Be the first to report a bus.'}
                </p>
              )}
            </div>

            {/* Arrival Times Breakdown */}
            <div className="flex items-center gap-4 text-right self-end sm:self-center shrink-0">
              {onboardingEta?.estimatedArrivalMinutes && busRelation === 'approaching_onboarding' && (
                <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] text-slate-500 block">Boarding In</span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    ~{onboardingEta.estimatedArrivalMinutes}m
                  </span>
                </div>
              )}

              {destinationEta?.estimatedArrivalMinutes && (
                <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] text-slate-500 block">Reach Destination</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    ~{destinationEta.estimatedArrivalMinutes}m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Approximate Fare Explanation */}
          <div className="text-[11px] text-emerald-900 bg-emerald-100/60 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2">
            <span>
              💡 <strong>Fare Note:</strong> {fareResult.notes}
            </span>
            <span className="shrink-0 text-slate-500">(All fares are approximate)</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
          Please select a destination stop that comes after your boarding stop along the route.
        </div>
      )}
    </div>
  );
}
