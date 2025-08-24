'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { User, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isOnline: boolean;
}

interface ParticipantsListProps {
  participants: Participant[];
}

export default function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <div className="flex flex-col h-full bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">
          Participants ({participants.length})
        </h3>
      </div>

      {/* Participants List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="bg-slate-600 rounded-full p-2">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-700 ${
                      participant.isOnline ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="text-white font-medium">{participant.name}</div>
                  <div className="text-slate-400 text-xs">
                    {participant.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div
                  className={`p-1 rounded-full ${
                    participant.isAudioEnabled ? 'bg-green-500' : 'bg-red-500/80'
                  }`}
                >
                  {participant.isAudioEnabled ? (
                    <Mic className="w-3 h-3 text-white" />
                  ) : (
                    <MicOff className="w-3 h-3 text-white" />
                  )}
                </div>
                <div
                  className={`p-1 rounded-full ${
                    participant.isVideoEnabled ? 'bg-green-500' : 'bg-red-500/80'
                  }`}
                >
                  {participant.isVideoEnabled ? (
                    <Video className="w-3 h-3 text-white" />
                  ) : (
                    <VideoOff className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}