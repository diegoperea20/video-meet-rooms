'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, User, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VideoStreamProps {
  stream?: MediaStream | null;
  userName: string;
  isLocal: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  className?: string;
  isScreenShare?: boolean;
  showFullscreenButton?: boolean;
}

const VideoStream = forwardRef<HTMLVideoElement, VideoStreamProps>(
  ({ 
    stream, 
    userName, 
    isLocal, 
    isAudioEnabled, 
    isVideoEnabled, 
    autoPlay = false,
    muted = false,
    playsInline = false,
    className,
    isScreenShare = false,
    showFullscreenButton = false
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const finalRef = (ref as React.RefObject<HTMLVideoElement>) || videoRef;
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
      // Re-bind the MediaStream whenever it changes OR when the video element remounts
      // due to toggling visibility (isVideoEnabled)
      if (stream && finalRef.current) {
        finalRef.current.srcObject = stream;
      }
    }, [stream, isVideoEnabled, finalRef]);

    // Ensure playback starts when stream is attached or video toggles
    useEffect(() => {
      const el = finalRef.current;
      if (!el || !stream) return;
      const playPromise = el.play();
      if (playPromise && typeof (playPromise as Promise<void>).then === 'function') {
        (playPromise as Promise<void>).catch((err) => {
          console.warn('Video autoplay was prevented, will require user gesture:', err);
        });
      }
    }, [stream, isVideoEnabled, finalRef]);

    const toggleFullscreen = () => {
      if (!finalRef.current) return;
      
      if (!isFullscreen) {
        if (finalRef.current.requestFullscreen) {
          finalRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    };

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    }, []);

    return (
      <div className={cn(
        "relative h-full bg-slate-900 rounded-lg overflow-hidden",
        isScreenShare ? "min-h-[400px]" : "min-h-[200px]",
        className
      )}>
        {isVideoEnabled && stream ? (
          <video
            ref={finalRef}
            autoPlay={autoPlay}
            muted={muted}
            playsInline={playsInline}
            className={cn(
              "w-full h-full",
              isScreenShare ? "object-contain" : "object-cover"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="bg-slate-700 rounded-full p-6 flex flex-col items-center">
              <User className="w-12 h-12 text-slate-400 mb-2" />
              <span className="text-slate-400 text-sm text-center">{userName}</span>
            </div>
          </div>
        )}
        
        {/* User Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-white text-sm font-medium">
                {userName} {isLocal && '(You)'}
                {isScreenShare && ' (Screen Share)'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {showFullscreenButton && isVideoEnabled && isScreenShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="p-1 h-auto bg-black/40 hover:bg-black/60 border-0"
                >
                  {isFullscreen ? (
                    <Minimize className="w-3 h-3 text-white" />
                  ) : (
                    <Maximize className="w-3 h-3 text-white" />
                  )}
                </Button>
              )}
              <div className={cn(
                "p-1 rounded-full",
                isAudioEnabled ? "bg-green-500" : "bg-red-500"
              )}>
                {isAudioEnabled ? (
                  <Mic className="w-3 h-3 text-white" />
                ) : (
                  <MicOff className="w-3 h-3 text-white" />
                )}
              </div>
              <div className={cn(
                "p-1 rounded-full",
                isVideoEnabled ? "bg-green-500" : "bg-red-500"
              )}>
                {isVideoEnabled ? (
                  <Video className="w-3 h-3 text-white" />
                ) : (
                  <VideoOff className="w-3 h-3 text-white" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoStream.displayName = 'VideoStream';

export default VideoStream;