'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(socket: Socket | null, localVideoRef: React.RefObject<HTMLVideoElement>) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenShares, setRemoteScreenShares] = useState<{ [id: string]: boolean }>({});
  
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<{ [id: string]: RTCIceCandidateInit[] }>({});
  const pendingPeers = useRef<Set<string>>(new Set());
  const pendingSdp = useRef<{ [id: string]: RTCSessionDescriptionInit | null }>({});
  // Screen share tracking
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const isScreenSharingRef = useRef<boolean>(false);
  const preShareVideoEnabledRef = useRef<boolean>(true);

  // Helper to apply any pending SDP after a PC is created
  const applyPendingSdpIfAny = useCallback(async (peerId: string) => {
    const pc = peerConnections.current[peerId];
    const sdp = pendingSdp.current[peerId];
    if (!pc || !sdp) return;
    try {
      console.log('Applying pending SDP for', peerId, 'type:', sdp.type);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socket) {
          socket.emit('signal', peerId, JSON.stringify({ sdp: pc.localDescription }));
        }
      }
      // After remote description is set, process any buffered ICE
      if (pendingCandidates.current[peerId]) {
        for (const candidate of pendingCandidates.current[peerId]) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.error(e); }
        }
        pendingCandidates.current[peerId] = [];
      }
      pendingSdp.current[peerId] = null;
    } catch (e) {
      console.error('Error applying pending SDP for', peerId, e);
    }
  }, [socket]);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream, shouldCreateOffer: boolean = false) => {
    console.log('Creating peer connection for:', peerId, 'shouldCreateOffer:', shouldCreateOffer);
    
    const pc = new RTCPeerConnection(peerConnectionConfig);
    
    pc.onnegotiationneeded = async () => {
      // Trigger renegotiation when tracks change (e.g., camera toggled)
      try {
        if (pc.signalingState !== 'stable') {
          console.log('Skip negotiationneeded, signalingState:', pc.signalingState);
          return;
        }
        // Only the deterministic initiator should start renegotiation to avoid glare
        const selfId = socket?.id as string | undefined;
        if (!selfId || !(selfId < peerId)) {
          console.log('Not initiator for renegotiation, skipping offer for', peerId);
          return;
        }
        console.log('Negotiation needed for:', peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket) {
          socket.emit('signal', peerId, JSON.stringify({ sdp: pc.localDescription }));
        }
      } catch (e) {
        console.error('Error during negotiationneeded for', peerId, e);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('Sending ICE candidate to:', peerId);
        socket.emit('signal', peerId, JSON.stringify({ ice: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote stream from:', peerId);
      const remoteStream = event.streams[0];
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: remoteStream
      }));
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed for', peerId, ':', pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('Signaling state changed for', peerId, ':', pc.signalingState);
    };

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track.kind);
      pc.addTrack(track, stream);
    });

    peerConnections.current[peerId] = pc;

    // If we are currently screen sharing, ensure the video sender uses the screen track
    if (isScreenSharingRef.current && screenTrackRef.current) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrackRef.current).then(() => {
          console.log('Applied screen track to new peer connection:', peerId);
        }).catch((e) => console.error('Error applying screen track to new PC', peerId, e));
      }
    }

    // Create offer if this is the initiating peer
    if (shouldCreateOffer) {
      console.log('Creating offer for:', peerId);
      pc.createOffer()
        .then(offer => {
          console.log('Offer created for:', peerId);
          return pc.setLocalDescription(offer);
        })
        .then(() => {
          if (socket) {
            console.log('Sending offer to:', peerId);
            socket.emit('signal', peerId, JSON.stringify({ sdp: pc.localDescription }));
          }
        })
        .catch(error => console.error('Error creating offer for', peerId, ':', error));
    }

    return pc;
  }, [socket]);

  const handleSignal = useCallback(async (fromId: string, message: string) => {
    try {
      const signal = JSON.parse(message);
      console.log('Handling signal from:', fromId, 'type:', signal.sdp?.type || 'ice');
      
      let pc = peerConnections.current[fromId];

      if (!pc && localStreamRef.current) {
        console.log('Creating new peer connection for signal from:', fromId);
        pc = createPeerConnection(fromId, localStreamRef.current, false);
      }

      // If still no peer connection or local media not ready, buffer SDP for later
      if (!pc) {
        if (signal.sdp) {
          console.log('Buffering SDP for', fromId, 'until PC/media ready');
          pendingSdp.current[fromId] = signal.sdp;
          pendingPeers.current.add(fromId);
        }
        return;
      }

      if (signal.sdp) {
        console.log('Processing SDP from:', fromId, 'type:', signal.sdp.type);
        
        if (pc.signalingState === 'closed') {
          console.warn('Peer connection is closed for:', fromId);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        if (signal.sdp.type === 'offer') {
          console.log('Creating answer for:', fromId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socket) {
            console.log('Sending answer to:', fromId);
            socket.emit('signal', fromId, JSON.stringify({ sdp: pc.localDescription }));
          }
        }

        // Process any pending ICE candidates
        if (pendingCandidates.current[fromId]) {
          console.log('Processing pending ICE candidates for:', fromId);
          for (const candidate of pendingCandidates.current[fromId]) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding pending ICE candidate:', e);
            }
          }
          pendingCandidates.current[fromId] = [];
        }
      }

      if (signal.ice) {
        console.log('Processing ICE candidate from:', fromId);
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
            console.log('ICE candidate added for:', fromId);
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        } else {
          // Buffer ICE candidates until remote description is set
          if (!pendingCandidates.current[fromId]) {
            pendingCandidates.current[fromId] = [];
          }
          pendingCandidates.current[fromId].push(signal.ice);
          console.log('ICE candidate buffered for:', fromId);
        }
      }
    } catch (error) {
      console.error('Error handling signal from', fromId, ':', error);
    }
  }, [socket, createPeerConnection]);

  const startCall = useCallback(async () => {
    try {
      console.log('Starting call - requesting media access...');

      // Set up socket event listeners for WebRTC signaling EARLY to avoid races
      if (socket) {
        console.log('Setting up socket listeners for WebRTC');

        socket.on('signal', (fromId: string, message: string) => {
          console.log('Received signal from:', fromId);
          handleSignal(fromId, message);
        });

        // Initial user list for the joiner
        socket.on('user-list', (userList: any[]) => {
          const selfId = socket.id as string;
          const peers: string[] = userList.map(u => u.id).filter((id: string) => id !== selfId);
          console.log('Processing user-list for peers:', peers);
          peers.forEach((peerId) => {
            if (!peerConnections.current[peerId]) {
              if (localStreamRef.current) {
                const initiator = selfId < peerId; // deterministic initiator
                console.log('Creating PC from user-list for:', peerId, 'initiator:', initiator);
                createPeerConnection(peerId, localStreamRef.current, initiator);
                // If there was a pending SDP from this peer, apply it now
                applyPendingSdpIfAny(peerId);
              } else {
                pendingPeers.current.add(peerId);
              }
            }
          });
        });

        // When any user joins, create missing peer connections
        socket.on('user-joined', (_id: string, clients: string[], _userList: any[]) => {
          const selfId = socket.id as string;
          console.log('User joined event - ensuring peer connections');
          const otherClients = clients.filter((clientId) => clientId !== selfId);
          otherClients.forEach((clientId) => {
            if (!peerConnections.current[clientId]) {
              if (localStreamRef.current) {
                const initiator = selfId < clientId; // deterministic initiator
                console.log('Creating PC for joined user:', clientId, 'initiator:', initiator);
                createPeerConnection(clientId, localStreamRef.current, initiator);
                applyPendingSdpIfAny(clientId);
              } else {
                pendingPeers.current.add(clientId);
              }
            }
          });
        });

        socket.on('user-left', (id: string, _userList: any[]) => {
          console.log('User left:', id);
          if (peerConnections.current[id]) {
            peerConnections.current[id].close();
            delete peerConnections.current[id];
          }
          setRemoteStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[id];
            return newStreams;
          });
          setRemoteScreenShares(prev => {
            const newShares = { ...prev };
            delete newShares[id];
            return newShares;
          });
        });

        socket.on('track-change', (userId: string, data: { kind: string; enabled: boolean; isScreenShare?: boolean }) => {
          if (data.kind === 'video' && typeof data.isScreenShare === 'boolean') {
            setRemoteScreenShares(prev => ({
              ...prev,
              [userId]: data.isScreenShare as boolean
            }));
          }
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Media stream obtained:', stream);
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Local video element updated');
      }

      // Process any peers that joined before our media was ready
      if (socket && pendingPeers.current.size > 0) {
        const selfId = socket.id as string;
        pendingPeers.current.forEach((peerId) => {
          if (!peerConnections.current[peerId]) {
            const initiator = selfId < peerId;
            console.log('Processing pending peer:', peerId, 'initiator:', initiator);
            createPeerConnection(peerId, stream, initiator);
            applyPendingSdpIfAny(peerId);
          }
        });
        pendingPeers.current.clear();
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, [socket, localVideoRef, applyPendingSdpIfAny, createPeerConnection, handleSignal]);


  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    if (isAudioEnabled) {
      // Turn OFF microphone - stop the track
      console.log('Turning OFF microphone - stopping track');
      audioTrack.stop();
      localStreamRef.current.removeTrack(audioTrack);
      
      // Create a silent audio track to maintain connection
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // Silent
      oscillator.connect(gainNode);
      const destination = gainNode.connect(audioContext.createMediaStreamDestination());
      oscillator.start();
      
      const silentStream = (destination as MediaStreamAudioDestinationNode).stream;
      const silentTrack = silentStream.getAudioTracks()[0];
      silentTrack.enabled = false;
      
      localStreamRef.current.addTrack(silentTrack);
      
      // Replace track in all peer connections
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(silentTrack);
        }
      });
      
      setIsAudioEnabled(false);
      
      // Notify other peers
      if (socket) {
        socket.emit('track-change', { kind: 'audio', enabled: false });
      }
    } else {
      // Turn ON microphone - get new audio stream
      console.log('Turning ON microphone - requesting new audio stream');
      navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then(newStream => {
          const newAudioTrack = newStream.getAudioTracks()[0];
          
          // Remove silent track
          const currentAudioTrack = localStreamRef.current!.getAudioTracks()[0];
          if (currentAudioTrack) {
            currentAudioTrack.stop();
            localStreamRef.current!.removeTrack(currentAudioTrack);
          }
          
          // Add new audio track
          localStreamRef.current!.addTrack(newAudioTrack);
          
          // Replace track in all peer connections
          Object.values(peerConnections.current).forEach((pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) {
              sender.replaceTrack(newAudioTrack);
            } else {
              pc.addTrack(newAudioTrack, localStreamRef.current!);
            }
          });
          
          setIsAudioEnabled(true);
          
          // Notify other peers
          if (socket) {
            socket.emit('track-change', { kind: 'audio', enabled: true });
          }
        })
        .catch(error => {
          console.error('Error turning on microphone:', error);
        });
    }
  }, [socket, isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    if (isVideoEnabled) {
      // Turn OFF camera - stop the track to turn off LED
      console.log('Turning OFF camera - stopping track to turn off LED');
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (!videoTrack) return;
      
      videoTrack.stop();
      localStreamRef.current.removeTrack(videoTrack);
      
      // Create a black video track to maintain connection
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const blackStream = canvas.captureStream(1);
      const blackTrack = blackStream.getVideoTracks()[0];
      blackTrack.enabled = false;
      
      localStreamRef.current.addTrack(blackTrack);
      
      // Update local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      
      // Replace track in all peer connections
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(blackTrack);
        }
      });
      
      setIsVideoEnabled(false);
      
      // Notify other peers
      if (socket) {
        socket.emit('track-change', { kind: 'video', enabled: false });
      }
    } else {
      // Turn ON camera - get new video stream
      console.log('Turning ON camera - requesting new video stream');
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(newStream => {
          const newVideoTrack = newStream.getVideoTracks()[0];
          
          // Remove black track
          const currentVideoTrack = localStreamRef.current!.getVideoTracks()[0];
          if (currentVideoTrack) {
            currentVideoTrack.stop();
            localStreamRef.current!.removeTrack(currentVideoTrack);
          }
          
          // Add new video track
          localStreamRef.current!.addTrack(newVideoTrack);
          
          // Create new stream with all tracks for proper video element update
          const updatedStream = new MediaStream();
          localStreamRef.current!.getTracks().forEach(track => {
            updatedStream.addTrack(track);
          });
          
          // Update local stream state and ref to stay in sync
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);
          
          // Update local video element immediately
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = updatedStream;
            // Force video element to load the new stream
            localVideoRef.current.load();
          }
          
          // Replace track in all peer connections
          Object.values(peerConnections.current).forEach((pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            } else {
              pc.addTrack(newVideoTrack, localStreamRef.current!);
            }
          });
          
          setIsVideoEnabled(true);
          
          // Notify other peers
          if (socket) {
            socket.emit('track-change', { kind: 'video', enabled: true });
          }
        })
        .catch(error => {
          console.error('Error turning on camera:', error);
        });
    }
  }, [socket, isVideoEnabled]);

  const startScreenShare = useCallback(async () => {
    try {
      console.log('Starting screen share...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      
      // Replace video track in peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      // Track screen share state and previous UI state
      preShareVideoEnabledRef.current = isVideoEnabled;
      screenTrackRef.current = videoTrack || null;
      isScreenSharingRef.current = !!videoTrack;
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
          console.log('Screen share track replaced in peer connection');
        }
      });
      
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen share ended');
        stopScreenShare();
      });
      setIsScreenSharing(true);
      if (socket) {
        socket.emit('track-change', { kind: 'video', enabled: true, isScreenShare: true });
      }
      
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVideoRef, isVideoEnabled, socket]);

  const stopScreenShare = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      // Replace screen share track back to camera
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
          console.log('Camera track restored in peer connection');
        }
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      // Clear screen share state
      isScreenSharingRef.current = false;
      screenTrackRef.current = null;
      setIsScreenSharing(false);
      // Restore prior UI state and notify peers
      const restored = preShareVideoEnabledRef.current;
      setIsVideoEnabled(restored);
      if (socket) {
        socket.emit('track-change', { kind: 'video', enabled: restored, isScreenShare: false });
      }
    }
  }, [localVideoRef, socket]);

  const endCall = useCallback(() => {
    console.log('Ending call...');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
    }
    
    Object.values(peerConnections.current).forEach((pc) => {
      pc.close();
    });
    peerConnections.current = {};
    
    setLocalStream(null);
    setRemoteStreams({});
    localStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled);
      }
      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  return {
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
    endCall
  };
}