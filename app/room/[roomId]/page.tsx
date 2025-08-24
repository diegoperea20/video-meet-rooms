"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Monitor,
  MessageSquare,
  Users,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import VideoStream from "@/components/VideoStream";
import ChatPanel from "@/components/ChatPanel";
import ParticipantsList from "@/components/ParticipantsList";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function Room() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const userName = searchParams.get("name") || "Anonymous";

  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [copied, setCopied] = useState(false);
  const [callStarted, setCallStarted] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const {
    socket,
    participants,
    messages,
    unreadCount,
    sendMessage,
    markMessagesAsRead,
    isConnected,
  } = useSocket(roomId, userName);
  const {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    remoteScreenShares,
    startCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    endCall,
  } = useWebRTC(socket, localVideoRef);

  useEffect(() => {
    if (socket && isConnected && !callStarted) {
      console.log("Starting call...");
      startCall()
        .then(() => {
          setCallStarted(true);
          console.log("Call started successfully");
        })
        .catch((error) => {
          console.error("Failed to start call:", error);
          toast.error(
            "Failed to access camera/microphone. Please check permissions."
          );
        });
    }
  }, [socket, isConnected, startCall, callStarted]);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (showChat) {
      markMessagesAsRead();
    }
  }, [showChat, markMessagesAsRead]);

  const handleToggleAudio = () => {
    toggleAudio();
  };

  const handleToggleVideo = () => {
    toggleVideo();
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      toast.success("Screen sharing stopped");
    } else {
      try {
        await startScreenShare();
        toast.success("Screen sharing started");
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          toast.error(
            "Screen sharing permission denied. Please allow access and try again."
          );
        } else {
          toast.error("Failed to start screen sharing");
        }
      }
    }
  };

  const handleEndCall = () => {
    endCall();
    toast.success("Call ended");
    window.location.href = "/";
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success("Room ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomUrl = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Room URL copied to clipboard");
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Connecting to room...</p>
          <p className="text-slate-400 text-sm mt-2">
            Make sure the Socket.IO server is running on port 4001
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-white">VideoMeet</h1>
            <Badge variant="secondary" className="bg-blue-600 text-white">
              {participants.length} participants
            </Badge>
            <Badge
              variant="outline"
              className="border-green-500 text-green-400"
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyRoomId}
              className="border-slate-600 text-slate-300 bg-slate-700"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy Room ID"}
            </Button>
            {/*  <Button
              variant="outline"
              size="sm"
              onClick={copyRoomUrl}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Copy className="w-4 h-4" />
              Copy URL
            </Button> */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowParticipants(!showParticipants)}
              className="border-slate-600 text-slate-300 bg-slate-700"
            >
              <Users className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="border-slate-600 text-slate-300 bg-slate-700"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge className="ml-1 bg-red-500 text-white text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main Video Area */}
        <div className="flex-1 p-4">
          {/* Check if anyone is screen sharing to adapt layout */}
          {isScreenSharing ||
          Object.values(remoteScreenShares).some(Boolean) ? (
            <div className="flex flex-col lg:flex-row gap-4 h-full">
              {/* Screen Share Section - Takes most space */}
              <div className="flex-1">
                {isScreenSharing ? (
                  <Card className="bg-slate-800 border-slate-700 overflow-hidden h-full">
                    <VideoStream
                      ref={localVideoRef}
                      stream={localStream}
                      userName={`${userName} (You)`}
                      isLocal={true}
                      isAudioEnabled={isAudioEnabled}
                      isVideoEnabled={isVideoEnabled}
                      isScreenShare={true}
                      showFullscreenButton={true}
                      autoPlay
                      muted
                      playsInline
                      className="h-full"
                    />
                  </Card>
                ) : (
                  /* Find the remote user who is screen sharing */
                  participants
                    .filter(
                      (participant) =>
                        participant.id !== socket?.id &&
                        remoteScreenShares[participant.id]
                    )
                    .map((participant) => {
                      const remoteStream = remoteStreams[participant.id];
                      return (
                        <Card
                          key={participant.id}
                          className="bg-slate-800 border-slate-700 overflow-hidden h-full"
                        >
                          <VideoStream
                            stream={remoteStream}
                            userName={participant.name}
                            isLocal={false}
                            isAudioEnabled={participant.isAudioEnabled}
                            isVideoEnabled={participant.isVideoEnabled}
                            isScreenShare={true}
                            showFullscreenButton={true}
                            autoPlay
                            playsInline
                            className="h-full"
                          />
                        </Card>
                      );
                    })[0] /* Only show the first screen share */
                )}
              </div>

              {/* Participants Sidebar */}
              <div className="lg:w-80 flex lg:flex-col gap-4">
                {/* Local video if not screen sharing */}
                {!isScreenSharing && (
                  <Card className="bg-slate-800 border-slate-700 overflow-hidden flex-1 lg:flex-none lg:h-60">
                    <VideoStream
                      ref={localVideoRef}
                      stream={localStream}
                      userName={`${userName} (You)`}
                      isLocal={true}
                      isAudioEnabled={isAudioEnabled}
                      isVideoEnabled={isVideoEnabled}
                      autoPlay
                      muted
                      playsInline
                      className="h-full"
                    />
                  </Card>
                )}

                {/* Other participants (excluding screen sharer) */}
                {participants
                  .filter(
                    (participant) =>
                      participant.id !== socket?.id &&
                      !remoteScreenShares[participant.id]
                  )
                  .map((participant) => {
                    const remoteStream = remoteStreams[participant.id];
                    return (
                      <Card
                        key={participant.id}
                        className="bg-slate-800 border-slate-700 overflow-hidden flex-1 lg:flex-none lg:h-60"
                      >
                        <VideoStream
                          stream={remoteStream}
                          userName={participant.name}
                          isLocal={false}
                          isAudioEnabled={participant.isAudioEnabled}
                          isVideoEnabled={participant.isVideoEnabled}
                          autoPlay
                          playsInline
                          className="h-full"
                        />
                      </Card>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Normal grid layout when no screen sharing */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
              {/* Local Video */}
              <Card className="bg-slate-800 border-slate-700 overflow-hidden">
                <VideoStream
                  ref={localVideoRef}
                  stream={localStream}
                  userName={`${userName} (You)`}
                  isLocal={true}
                  isAudioEnabled={isAudioEnabled}
                  isVideoEnabled={isVideoEnabled}
                  autoPlay
                  muted
                  playsInline
                  className="h-full"
                />
              </Card>

              {/* Remote Videos */}
              {participants
                .filter((participant) => participant.id !== socket?.id)
                .map((participant) => {
                  const remoteStream = remoteStreams[participant.id];

                  return (
                    <Card
                      key={participant.id}
                      className="bg-slate-800 border-slate-700 overflow-hidden"
                    >
                      <VideoStream
                        stream={remoteStream}
                        userName={participant.name}
                        isLocal={false}
                        isAudioEnabled={participant.isAudioEnabled}
                        isVideoEnabled={participant.isVideoEnabled}
                        autoPlay
                        playsInline
                        className="h-full"
                      />
                    </Card>
                  );
                })}
            </div>
          )}
        </div>

        {/* Side Panels */}
        {showParticipants && (
          <div className="w-80 border-l border-slate-700">
            <ParticipantsList participants={participants} />
          </div>
        )}

        {showChat && (
          <div className="w-80 border-l border-slate-700">
            <ChatPanel
              messages={messages}
              onSendMessage={sendMessage}
              currentUser={userName}
              onMarkAsRead={markMessagesAsRead}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleToggleAudio}
            className={`rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 transition-all ${
              isAudioEnabled
                ? "bg-green-600 hover:bg-green-700 border-green-500 text-white"
                : "bg-red-600 hover:bg-red-700 border-red-500 text-white"
            }`}
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleToggleVideo}
            className={`rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 transition-all ${
              isVideoEnabled
                ? "bg-green-600 hover:bg-green-700 border-green-500 text-white"
                : "bg-red-600 hover:bg-red-700 border-red-500 text-white"
            }`}
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleScreenShare}
            className={`rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 transition-all ${
              isScreenSharing
                ? "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
                : "bg-slate-600 hover:bg-slate-700 border-slate-500 text-white"
            }`}
          >
            <Monitor className="w-5 h-5" />
          </Button>

          {/* <Button
            variant="outline"
            size="lg"
            className="rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 bg-slate-600 hover:bg-slate-700 border-slate-500 text-white transition-all"
          >
            <Settings className="w-5 h-5" />
          </Button> */}

          <a
            href="https://github.com/diegoperea20"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 bg-slate-600 hover:bg-slate-700 border-slate-500 text-white transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              x="0px"
              y="0px"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10.9,2.1c-4.6,0.5-8.3,4.2-8.8,8.7c-0.5,4.7,2.2,8.9,6.3,10.5C8.7,21.4,9,21.2,9,20.8v-1.6c0,0-0.4,0.1-0.9,0.1 c-1.4,0-2-1.2-2.1-1.9c-0.1-0.4-0.3-0.7-0.6-1C5.1,16.3,5,16.3,5,16.2C5,16,5.3,16,5.4,16c0.6,0,1.1,0.7,1.3,1c0.5,0.8,1.1,1,1.4,1 c0.4,0,0.7-0.1,0.9-0.2c0.1-0.7,0.4-1.4,1-1.8c-2.3-0.5-4-1.8-4-4c0-1.1,0.5-2.2,1.2-3C7.1,8.8,7,8.3,7,7.6c0-0.4,0-0.9,0.2-1.3 C7.2,6.1,7.4,6,7.5,6c0,0,0.1,0,0.1,0C8.1,6.1,9.1,6.4,10,7.3C10.6,7.1,11.3,7,12,7s1.4,0.1,2,0.3c0.9-0.9,2-1.2,2.5-1.3 c0,0,0.1,0,0.1,0c0.2,0,0.3,0.1,0.4,0.3C17,6.7,17,7.2,17,7.6c0,0.8-0.1,1.2-0.2,1.4c0.7,0.8,1.2,1.8,1.2,3c0,2.2-1.7,3.5-4,4 c0.6,0.5,1,1.4,1,2.3v2.6c0,0.3,0.3,0.6,0.7,0.5c3.7-1.5,6.3-5.1,6.3-9.3C22,6.1,16.9,1.4,10.9,2.1z"></path>
            </svg>
          </a>

          <Button
            variant="outline"
            size="lg"
            onClick={handleEndCall}
            className="rounded-full w-12 h-12 p-0 flex items-center justify-center border-2 bg-red-600 hover:bg-red-700 border-red-500 text-white transition-all"
          >
            <Phone className="w-5 h-5 rotate-[225deg]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
