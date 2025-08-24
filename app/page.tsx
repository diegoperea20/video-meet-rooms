"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Video, Users, MessageSquare, Shield } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const createRoom = () => {
    const newRoomId = uuidv4();
    if (userName.trim()) {
      router.push(`/room/${newRoomId}?name=${encodeURIComponent(userName)}`);
    }
  };

  const joinRoom = () => {
    const trimmedRoomId = roomId.trim();
    const trimmedUserName = userName.trim();

    if (trimmedRoomId && trimmedUserName) {
      router.push(
        `/room/${trimmedRoomId}?name=${encodeURIComponent(trimmedUserName)}`
      );
    } else {
      if (!trimmedUserName) {
        toast.error("Please enter your name");
      }
      if (!trimmedRoomId) {
        toast.error("Please enter a room ID");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-500 rounded-full p-4">
              <Video className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">VideoMeet</h1>
          <p className="text-xl text-gray-300">
            Connect face-to-face with high-quality video calls
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-white">
                Join or Create Meeting
              </CardTitle>
              <CardDescription className="text-gray-300">
                Enter your name and room details to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-4">
                <Button
                  onClick={createRoom}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!userName.trim()}
                >
                  Create New Room
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-gray-400">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Room ID
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  />
                </div>

                <Button
                  onClick={joinRoom}
                  variant="outline"
                  className="w-full  bg-blue-600 hover:bg-blue-700 text-white border-0 hover:text-white"
                  disabled={!roomId.trim() || !userName.trim()}
                >
                  Join Room
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-blue-500/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <a
                href="https://github.com/diegoperea20/video-meet-rooms"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  x="0px"
                  y="0px"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-blue-400"
                >
                  <path d="M10.9,2.1c-4.6,0.5-8.3,4.2-8.8,8.7c-0.5,4.7,2.2,8.9,6.3,10.5C8.7,21.4,9,21.2,9,20.8v-1.6c0,0-0.4,0.1-0.9,0.1 c-1.4,0-2-1.2-2.1-1.9c-0.1-0.4-0.3-0.7-0.6-1C5.1,16.3,5,16.3,5,16.2C5,16,5.3,16,5.4,16c0.6,0,1.1,0.7,1.3,1c0.5,0.8,1.1,1,1.4,1 c0.4,0,0.7-0.1,0.9-0.2c0.1-0.7,0.4-1.4,1-1.8c-2.3-0.5-4-1.8-4-4c0-1.1,0.5-2.2,1.2-3C7.1,8.8,7,8.3,7,7.6c0-0.4,0-0.9,0.2-1.3 C7.2,6.1,7.4,6,7.5,6c0,0,0.1,0,0.1,0C8.1,6.1,9.1,6.4,10,7.3C10.6,7.1,11.3,7,12,7s1.4,0.1,2,0.3c0.9-0.9,2-1.2,2.5-1.3 c0,0,0.1,0,0.1,0c0.2,0,0.3,0.1,0.4,0.3C17,6.7,17,7.2,17,7.6c0,0.8-0.1,1.2-0.2,1.4c0.7,0.8,1.2,1.8,1.2,3c0,2.2-1.7,3.5-4,4 c0.6,0.5,1,1.4,1,2.3v2.6c0,0.3,0.3,0.6,0.7,0.5c3.7-1.5,6.3-5.1,6.3-9.3C22,6.1,16.9,1.4,10.9,2.1z"></path>
                </svg>
              </a>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Github Repository
            </h3>
            <p className="text-gray-400">
              Check out our GitHub repository for more details and support
            </p>
          </div>
          <div className="text-center">
            <div className="bg-green-500/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Multiple Participants
            </h3>
            <p className="text-gray-400">
              Connect with multiple people in one room
            </p>
          </div>
          <div className="text-center">
            <div className="bg-purple-500/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Live Chat</h3>
            <p className="text-gray-400">Real-time messaging during calls</p>
          </div>
        </div>
      </div>
    </div>
  );
}
