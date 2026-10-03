/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Direction, BusReport, StopETA, RouteStop, LiveStatusSummary, ActiveBus } from './types/bus';
import {
  getStoredReports,
  getReportsForDirection,
  getLiveStatusSummary,
  clearAllReports,
  eraseLateReports,
} from './services/busReportService';
import { calculateRouteETAs } from './services/etaService';
import { getStopsForDirection } from './services/routeService';
import { calculateCorridorFare } from './services/fareService';
import { LiveRouteMap } from './components/LiveRouteMap';
import { StopETAList } from './components/StopETAList';
import { RecentReportsFeed } from './components/RecentReportsFeed';
import { ReportBusView } from './components/ReportBusView';
import { PhotoEvidenceModal } from './components/PhotoEvidenceModal';
import { PassengerJourneyPlanner } from './components/PassengerJourneyPlanner';
import {
  Bus,
  Camera,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Navigation,
  Sparkles,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Database,
  Flag,
  Trash2,
} from 'lucide-react';

type TabView = 'map' | 'stops' | 'plan' | 'sightings';

export default function App() {
  const [direction, setDirection] = useState<Direction>('sira_to_tumakuru');
  const [activeTab, setActiveTab] = useState<TabView>('map');
  const [reports, setReports] = useState<BusReport[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusSummary | null>(null);
  const [etas, setEtas] = useState<StopETA[]>([]);

  // Selected Bus Journey ID for Multi-Bus Focus
  const [selectedBusJourneyId, setSelectedBusJourneyId] = useState<string | null>(null);

  // Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Selected Passenger Journey Segment (Onboarding & Destination)
  const [onboardingStopId, setOnboardingStopId] = useState<string>('sira_bus_stand');
  const [destinationStopId, setDestinationStopId] = useState<string>('tumakuru_bus_stand');

  const [photoPreviewData, setPhotoPreviewData] = useState<{
    url: string;
    stopName: string;
    time: string;
    report?: BusReport | null;
  } | null>(null);

  // User geolocation state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userLocating, setUserLocating] = useState(false);

  // Offline / Network monitor
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Reset default onboarding/destination when direction switches
  useEffect(() => {
    eraseLateReports(4);
    const stops = getStopsForDirection(direction);
    setOnboardingStopId(stops[0].id);
    setDestinationStopId(stops[stops.length - 1].id);
    setSelectedBusJourneyId(null);
  }, [direction]);

  const handleEraseLateReports = () => {
    eraseLateReports(4);
    refreshData();
  };

  // Load and refresh bus data (updates every 10 seconds to auto-advance stops as time passes)
  const refreshData = () => {
    const dirReports = getReportsForDirection(direction);
    setReports(dirReports);
    const summary = getLiveStatusSummary(direction, onboardingStopId);
    setLiveStatus(summary);

    // If focused bus exists, compute its ETAs, otherwise default to primary
    const currentBus = summary.activeBuses.find((b) => b.journeyId === selectedBusJourneyId) || summary.primaryBus;
    const calculatedEtas = calculateRouteETAs(direction, currentBus?.latestReport || summary.latestReport);
    setEtas(calculatedEtas);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [direction, selectedBusJourneyId, onboardingStopId]);

  // Network event listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request browser GPS position
  const handleRequestUserLocation = () => {
    if (!navigator.geolocation) return;
    setUserLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setUserLocating(false);
      },
      () => {
        setUserLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleReportSuccess = (newReport: BusReport) => {
    refreshData();
    setSelectedBusJourneyId(newReport.journeyId);
    setActiveTab('map');
  };

  const handleClearReports = () => {
    clearAllReports();
    refreshData();
    setSelectedBusJourneyId(null);
  };

  const orderedStops = getStopsForDirection(direction);
  const activeBuses = liveStatus?.activeBuses || [];
  const focusedBus = activeBuses.find((b) => b.journeyId === selectedBusJourneyId) || liveStatus?.primaryBus || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 pb-20 md:pb-8">
      {/* Offline Toast */}
      {!isOnline && (
        <div className="bg-slate-800 text-amber-300 text-xs px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Weak or offline connection. Showing cached route data and stops.</span>
        </div>
      )}

      {/* Offline Toast */}
      {!isOnline && (
        <div className="bg-slate-800 text-amber-300 text-xs px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Weak or offline connection. Showing cached route data and stops.</span>
        </div>
      )}

      {/* 2. Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-700/20">
              <Bus className="w-5 h-5" />
            </div>
            <a href="/" className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 leading-tight">
              Sira–Tumakuru Bus Tracker
            </a>
          </div>

          {/* Zone 2: Navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('map')}
              className={`transition-colors hover:text-emerald-700 pb-0.5 ${
                activeTab === 'map' ? 'text-emerald-700 border-b-2 border-emerald-600' : ''
              }`}
            >
              Live Map
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`transition-colors hover:text-emerald-700 pb-0.5 ${
                activeTab === 'plan' ? 'text-emerald-700 border-b-2 border-emerald-600' : ''
              }`}
            >
              My Journey & Fares
            </button>
            <button
              onClick={() => setActiveTab('stops')}
              className={`transition-colors hover:text-emerald-700 pb-0.5 ${
                activeTab === 'stops' ? 'text-emerald-700 border-b-2 border-emerald-600' : ''
              }`}
            >
              Stops & ETA
            </button>
            <button
              onClick={() => setActiveTab('sightings')}
              className={`transition-colors hover:text-emerald-700 pb-0.5 ${
                activeTab === 'sightings' ? 'text-emerald-700 border-b-2 border-emerald-600' : ''
              }`}
            >
              Photo Evidence ({reports.length})
            </button>
          </nav>

          {/* Zone 3: Primary action button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="h-10 px-4 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              <span>Report Bus</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex-1 w-full flex flex-col gap-5">
        {/* Header Kicker & Direction Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Where are you going?
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              100% Real User Reports · Karnataka Red & Blue Buses Only · Fares: approx. ₹60 from Sira, approx. ₹46 from Kallambella
            </p>
          </div>

          {/* Direction Segmented Control */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl max-w-md w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDirection('sira_to_tumakuru')}
              className={`h-11 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                direction === 'sira_to_tumakuru'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Sira</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tumakuru</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('tumakuru_to_sira')}
              className={`h-11 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                direction === 'tumakuru_to_sira'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tumakuru</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sira</span>
            </button>
          </div>
        </div>

        {/* 3. Live Bus Status Hero Bar & Multiple Buses Spotlight */}
        {liveStatus && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    focusedBus?.isJourneyEnded
                      ? 'bg-slate-900 text-emerald-400'
                      : activeBuses.length > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {focusedBus?.isJourneyEnded ? (
                    <Flag className="w-6 h-6" />
                  ) : (
                    <Bus className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Live Sighting Status
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    {activeBuses.length > 0 ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{activeBuses.length} Active {activeBuses.length === 1 ? 'Bus' : 'Buses'} Reported</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">
                        No active bus currently reported
                      </span>
                    )}
                  </div>

                  {focusedBus ? (
                    <div className="mt-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        {focusedBus.busLabel}: now near{' '}
                        <span className="text-emerald-700">{focusedBus.currentCalculatedStop.name}</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reported by passenger near {focusedBus.reportedStop.name} ({focusedBus.minutesSinceReport}m ago) · Progressing in real time along NH 48
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <h2 className="text-base sm:text-lg font-bold text-slate-800">
                        Awaiting Passenger Reports
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No simulated or false sightings are added. Only genuine photos of Karnataka Red (Sarige) and Blue state buses reported by passengers will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {focusedBus?.latestReport?.photoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoPreviewData({
                        url: focusedBus.latestReport.photoUrl,
                        stopName: focusedBus.reportedStop.name,
                        time: new Date(focusedBus.latestReport.capturedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        report: focusedBus.latestReport,
                      })
                    }
                    className="h-10 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>View Bus Photo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshData}
                  className="h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Refresh sighting feed"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* MULTIPLE BUSES SELECTION PILLS (When multiple buses are on route) */}
            {activeBuses.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Multiple buses reported! Switch between active buses:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeBuses.map((bus) => {
                    const isSelected = (selectedBusJourneyId || liveStatus.primaryBus?.journeyId) === bus.journeyId;
                    return (
                      <button
                        key={bus.journeyId}
                        type="button"
                        onClick={() => setSelectedBusJourneyId(bus.journeyId)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Bus className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span>{bus.busLabel}</span>
                        <span className="text-[10px] font-normal opacity-80">
                          (~{bus.minutesSinceReport}m ago)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Dedicated Section: Where are you onboarding and where are you going? */}
        <PassengerJourneyPlanner
          direction={direction}
          stops={orderedStops}
          activeBuses={activeBuses}
          primaryBus={liveStatus?.primaryBus ?? null}
          onboardingStopId={onboardingStopId}
          destinationStopId={destinationStopId}
          selectedBusJourneyId={selectedBusJourneyId}
          onSelectBusJourney={(jId) => setSelectedBusJourneyId(jId)}
          onChangeOnboarding={(id) => setOnboardingStopId(id)}
          onChangeDestination={(id) => setDestinationStopId(id)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />

        {/* Mobile Tab Selector */}
        <div className="flex md:hidden items-center justify-around bg-white p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg text-center ${
              activeTab === 'map' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Live Map
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg text-center ${
              activeTab === 'plan' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            My Journey
          </button>
          <button
            onClick={() => setActiveTab('stops')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg text-center ${
              activeTab === 'stops' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Stops & ETA
          </button>
          <button
            onClick={() => setActiveTab('sightings')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg text-center ${
              activeTab === 'sightings' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Sightings ({reports.length})
          </button>
        </div>

        {/* 5. Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Column A: Map View */}
          <div
            className={`lg:col-span-7 flex flex-col gap-4 ${
              activeTab === 'map' ? 'block' : 'hidden md:flex'
            }`}
          >
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Live Highway Map</h3>
                  <p className="text-xs text-slate-500">
                    NH 48 · 15 Stops · Displays real passenger-reported buses only
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRequestUserLocation}
                    disabled={userLocating}
                    className="h-8 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${userLocating ? 'animate-spin' : ''}`} />
                    <span>{userLocating ? 'Locating...' : 'Locate Me'}</span>
                  </button>
                </div>
              </div>

              {/* Google Map rendering ALL active buses */}
              <LiveRouteMap
                direction={direction}
                activeBuses={activeBuses}
                primaryBus={liveStatus?.primaryBus}
                selectedBusJourneyId={selectedBusJourneyId}
                onSelectBus={(jId) => setSelectedBusJourneyId(jId)}
                etas={etas}
                userLocation={userLocation}
                onRequestUserLocation={handleRequestUserLocation}
                onSelectPhotoPreview={(url, stopName, time) => {
                  const matched = reports.find((r) => r.photoUrl === url);
                  setPhotoPreviewData({ url, stopName, time, report: matched });
                }}
              />
            </div>

            {/* Quick Sighting History */}
            <div className="hidden lg:block">
              <RecentReportsFeed
                reports={reports}
                onSelectPhotoPreview={(url, stopName, time, report) =>
                  setPhotoPreviewData({ url, stopName, time, report })
                }
              />
            </div>
          </div>

          {/* Column B: Stops Timeline & ETAs */}
          <div
            className={`lg:col-span-5 flex flex-col gap-4 ${
              activeTab === 'stops'
                ? 'block'
                : activeTab === 'sightings' || activeTab === 'plan'
                ? 'hidden'
                : 'hidden md:flex'
            }`}
          >
            <StopETAList
              etas={etas}
              latestReport={focusedBus?.latestReport || liveStatus?.latestReport || null}
              isJourneyEnded={focusedBus?.isJourneyEnded}
              onSelectPhotoPreview={(url, stopName, time) => {
                const matched = reports.find((r) => r.photoUrl === url);
                setPhotoPreviewData({ url, stopName, time, report: matched });
              }}
            />

            {/* Verification Rules & Reset Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 shadow-xs flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-800">Authentic Karnataka Bus Verification</h4>
                  <p className="mt-0.5 leading-relaxed text-[11px] text-slate-500">
                    To maintain strict realism, this application only accepts verified camera photos of <strong>Karnataka Red (KSRTC Sarige)</strong> and <strong>Karnataka Blue (State Express)</strong> buses. Private cars, white vans, or non-bus pictures are automatically rejected.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleEraseLateReports}
                  className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
                  title="Purge reports older than 4 hours"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Erase late reports (&gt;4 hrs)</span>
                </button>

                {reports.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearReports}
                    className="text-[11px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear all ({reports.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Sightings Feed Tab */}
          {activeTab === 'sightings' && (
            <div className="lg:hidden col-span-1">
              <RecentReportsFeed
                reports={reports}
                onSelectPhotoPreview={(url, stopName, time, report) =>
                  setPhotoPreviewData({ url, stopName, time, report })
                }
              />
            </div>
          )}
        </div>
      </main>

      {/* 6. Sticky Bottom Action Bar for Mobile Thumb Ergonomics */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-500 truncate">
            {direction === 'sira_to_tumakuru' ? 'Sira → Tumakuru' : 'Tumakuru → Sira'}
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {activeBuses.length > 0 ? `${activeBuses.length} buses active` : 'No active sightings'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="h-11 px-5 bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>Report Bus</span>
        </button>
      </div>

      {/* 7. Report Bus Modal (Camera Capture + Strict Karnataka Red/Blue AI Verification + 15 Stops Selector) */}
      {isReportModalOpen && (
        <ReportBusView
          initialDirection={direction}
          activeBuses={activeBuses}
          onClose={() => setIsReportModalOpen(false)}
          onReportSuccess={handleReportSuccess}
        />
      )}

      {/* 8. Passenger Photo Evidence Inspection Modal */}
      {photoPreviewData && (
        <PhotoEvidenceModal
          photoUrl={photoPreviewData.url}
          stopName={photoPreviewData.stopName}
          reportTime={photoPreviewData.time}
          report={photoPreviewData.report}
          onClose={() => setPhotoPreviewData(null)}
        />
      )}
    </div>
  );
}
