/**
 * Communication Hub - Customer Mobile App
 * Combined video calling and chat interface
 * Matches web app CommunicationHub component
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import VideoCallScreen from './VideoCallScreen';
import ChatPanel from './ChatPanel';
import { BrandColors, Typography, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface CommunicationHubProps {
  mode: 'video' | 'chat';
  bookingId: string;
  userId: string;
  userName: string;
  otherUserName: string;
  userType: 'customer' | 'vendor' | 'staff';
  onClose: () => void;
  onBookFollowUp?: () => void;
}

export default function CommunicationHub({
  mode,
  bookingId,
  userId,
  userName,
  otherUserName,
  userType,
  onClose,
  onBookFollowUp,
}: CommunicationHubProps) {
  const [activeMode, setActiveMode] = useState<'video' | 'chat'>(mode);
  const [isChatOpen, setIsChatOpen] = useState(mode === 'chat');
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const handleEndCall = () => {
    if (activeMode === 'video') {
      // Switch to chat after ending call
      setActiveMode('chat');
      setIsChatOpen(true);
    } else {
      onClose();
    }
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // In a real implementation, meetingId would come from the video call initialization
  // For now, we'll use bookingId as meetingId
  const currentMeetingId = meetingId || bookingId;

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Video Call View */}
        {activeMode === 'video' && (
          <View style={styles.videoContainer}>
            <VideoCallScreen
              bookingId={bookingId}
              userId={userId}
              userName={userName}
              otherUserName={otherUserName}
              onEndCall={handleEndCall}
              onToggleChat={handleToggleChat}
            />
          </View>
        )}

        {/* Chat Panel - Overlay on video or standalone */}
        {(activeMode === 'chat' || (activeMode === 'video' && isChatOpen)) && (
          <View style={[
            styles.chatContainer,
            activeMode === 'video' && styles.chatOverlay,
          ]}>
            <ChatPanel
              meetingId={currentMeetingId}
              userId={userId}
              userName={userName}
              otherUserName={otherUserName}
              onClose={activeMode === 'video' ? handleToggleChat : onClose}
            />
          </View>
        )}

        {/* Mode Toggle (if in video mode) */}
        {activeMode === 'video' && !isChatOpen && (
          <TouchableOpacity
            style={styles.chatToggleButton}
            onPress={handleToggleChat}
          >
            <Icon name="chat" size={24} color="#FFFFFF" />
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  chatToggleButton: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

